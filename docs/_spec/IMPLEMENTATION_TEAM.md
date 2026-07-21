# 撮るほど — 実装チーム編成

**更新日**: 2026-07-20  
**方式**: Architect-as-Orchestrator  
**アーキ正本**: `/Users/masa/dev/sorosoro` と同型（menva スタック）

## アーキテクチャ（sorosoro クローン）

```
Browser (PWA, mobile-first)
  → Next.js App Router on Vercel (region hnd1)
       ├ Middleware: session cookie ゲート
       ├ Better Auth (/api/auth/*) → Google OAuth (GCP)
       ├ Server Actions (records / settings / scan)
       ├ Gemini @google/genai (server-only; 無キー時はモック)
       ├ Vercel Blob (写真; 無キー時は data URL フォールバック可)
       └ Drizzle → Turso libSQL
Client: MapLibre GL JS (地図)
```

### ディレクトリ契約

```
src/
├── actions/          # "use server" — ActionResult パターン
├── app/
│   ├── (auth)/login/
│   ├── (main)/       # home は / または route group
│   │   ├── page.tsx  # ホーム
│   │   ├── scan/
│   │   ├── result/[id]/
│   │   ├── history/
│   │   ├── map/
│   │   └── settings/
│   ├── api/auth/[...all]/
│   ├── globals.css
│   └── layout.tsx
├── components/app/   # 画面単位クライアント UI
├── lib/
│   ├── auth*.ts
│   ├── db/
│   ├── domain/
│   ├── ai/
│   └── validation.ts
└── middleware.ts
```

### ドメインテーブル（tasks 置換）

- `records` — 旅の記録（PRODUCT_BRIEF）
- `user_settings` — ユーザー設定
- Better Auth 4 表は sorosoro と同一

## チーム編成

| ID | 役割 | 担当範囲 | 依存 | 並列 |
|----|------|----------|------|------|
| A0 | Architect | 分解・仕様・検証・統合 | — | — |
| F1 | Foundation | package, configs, auth, db client, middleware, layout, login, env, scripts | — | Wave 1 単独 |
| B1 | Backend Domain | schema records/settings, actions, AI/OCR service, rate-limit, validation | F1 | Wave 2 |
| U1 | UI Shell | globals tokens, TabBar, AppShell, home, settings, login ブランド | F1 | Wave 2 |
| U2 | UI Scan Flow | scan + loading + result + failed/partial | F1, B1 型 | Wave 2 |
| U3 | UI History/Map | history, map (MapLibre) | F1, B1 型 | Wave 2 |

### ファイル所有（衝突回避）

| レーン | 所有パス |
|--------|----------|
| F1 | package.json, configs, src/lib/auth*, src/lib/db/index.ts, middleware, layout, api/auth, scripts, .env.example, README |
| B1 | src/lib/db/schema.ts, src/actions/*, src/lib/domain/*, src/lib/ai/*, src/lib/validation.ts, src/lib/rate-limit.ts, src/lib/blob.ts |
| U1 | src/app/globals.css, src/components/app/tab-bar.tsx, app-shell.tsx, home-app.tsx, settings-app.tsx, login page, src/app/(main)/page.tsx, settings/page.tsx |
| U2 | scan-app.tsx, result-app.tsx, failed UI, src/app/(main)/scan, result |
| U3 | history-app.tsx, map-app.tsx, history/page, map/page |

## 共有インターフェース（全レーン厳守）

```ts
// ActionResult
type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Record DTO (client)
type RecordDTO = {
  id: string;
  photoUrl: string;
  title: string;
  easyText: string;
  detailText: string;
  easyRuby: string;
  detailRuby: string;
  aiNote: string;
  ocrRaw: string;
  partial: boolean;
  partialChars: string | null;
  lat: number | null;
  lng: number | null;
  placeName: string | null;
  memo: string | null;
  createdAt: string; // ISO
  saved: boolean;
};

// Scan AI result
type ScanAiResult =
  | { status: "failed" }
  | {
      status: "done" | "partial";
      title: string;
      easyText: string;
      detailText: string;
      easyRuby: string;
      detailRuby: string;
      aiNote: string;
      ocrRaw: string;
      partialChars?: string | null;
    };
```

### Actions（B1 が実装、UI が呼ぶ）

- `listRecordsAction()`
- `getRecordAction(id)`
- `createScanAction({ imageBase64 | blob, lat?, lng?, placeName? })` → 解析結果（未保存可）
- `saveRecordAction({ ...fields })`
- `updateMemoAction({ id, memo })`
- `deleteRecordAction({ id })`
- `getSettingsAction()` / `updateSettingsAction(...)`
- `deleteAllUserDataAction()`

## 検証ゲート

1. `npm install && npm run build` 成功
2. 型エラー 0
3. 旧ドメイン（tasks/task_logs）なし
4. 主要ルートが存在する
