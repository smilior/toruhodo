# 撮るほど（toruhodo）

スマホカメラで**石碑・案内板**を撮影すると、AI が**やさしい言葉**で解説してくれる PWA。  
タグライン: **かざすと、やさしく教えてくれる**

スタックは **menva-ai / sorosoro と同型**: **Next.js + Vercel + Turso + Better Auth + GCP (Google OAuth)**。  
加えて **Gemini（@google/genai・OCR＋解説）** / **Vercel Blob（写真）** / **Google Maps（地図）**。

| ドキュメント | 場所 |
|--------------|------|
| 企画書 | [`docs/00. 企画書/`](docs/00.%20企画書/) |
| プロダクトブリーフ | [`docs/_spec/PRODUCT_BRIEF.md`](docs/_spec/PRODUCT_BRIEF.md) |
| 設計書一式 | [`docs/`](docs/) |
| 静的プロトタイプ（認証なし） | [`prototype/`](prototype/) → [`prototype/index.html`](prototype/index.html) |

---

## 技術スタック

| 層 | 採用 |
|----|------|
| フレームワーク | Next.js 15 App Router + React 19 + TypeScript |
| ホスティング | Vercel |
| DB | Turso (libSQL) + Drizzle ORM |
| 認証 | Better Auth + Google OAuth（GCP） |
| ストレージ | Vercel Blob（写真・任意） |
| AI | Gemini（`gemini-3.5-flash-lite`。スキャン時のみ Google Search）— 未設定時はモック |
| 地図 | Google Maps JavaScript API |
| UI | Tailwind CSS v4 |
| ミューテーション | Server Actions / Route Handlers |

---

## 本番 CD（GitHub → Vercel / Turso）

| 経路 | トリガー | 内容 |
|------|----------|------|
| **アプリ** | `main` への push | Vercel が自動ビルド・本番デプロイ |
| **DB マイグレーション** | `main` push（`drizzle/**` 等変更時）または workflow_dispatch | GitHub Actions → 本番 Turso に `drizzle-kit migrate` |

### 本番に必要な環境変数（Vercel Production）

| 変数 | 備考 |
|------|------|
| `TURSO_DATABASE_URL` | 本番 Turso `libsql://...` |
| `TURSO_AUTH_TOKEN` | 本番 DB トークン |
| `BETTER_AUTH_SECRET` | 本番用に生成（ローカルと別推奨） |
| `BETTER_AUTH_URL` | 本番 URL（例: `https://toruhodo.vercel.app`） |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | 上と同じ |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | GCP。リダイレクトに本番 callback を追加 |
| `GEMINI_API_KEY` | **任意**。未設定時はモック解説 |
| `BLOB_READ_WRITE_TOKEN` | **任意**。未設定時は data URL を DB に保存 |

GitHub Actions の **production** environment secrets にも `TURSO_*` を設定する（migrate 用）。

---

## ローカル起動（最短）

### 前提

| ツール | 確認 |
|--------|------|
| Node.js 20+ | `node -v` |
| npm | `npm -v` |
| Turso CLI（任意・`turso dev` 利用時） | `turso --version` |

### 1. 依存関係

```bash
npm install
```

### 2. ローカル Turso を起動（必須）

開発時の DB は **常に localhost**（リモート `libsql://` は使わない）。

```bash
# ターミナル 1 — データを ./local.db に永続化
npm run db:dev
# → http://127.0.0.1:8080
```

| 項目 | 値 |
|------|-----|
| URL | `http://127.0.0.1:8080` |
| ファイル | `local.db`（gitignore 済み） |
| 認証 | 不要（`TURSO_AUTH_TOKEN=local-dev` は drizzle-kit 用ダミー） |

### 3. 環境変数

```bash
cp .env.example .env.local
# または（Turso 起動後）secret 生成 + スキーマ適用:
npm run setup:local
# → TURSO_DATABASE_URL を http://127.0.0.1:8080 に固定して push
```

`.env.local` で最低限埋めるもの:

| 変数 | 説明 |
|------|------|
| `TURSO_DATABASE_URL` | **固定** `http://127.0.0.1:8080` |
| `TURSO_AUTH_TOKEN` | `local-dev`（drizzle-kit 用ダミー。sqld は検証しない） |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`（`setup:local` が自動生成可） |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL` | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | GCP OAuth クライアント ID |
| `GOOGLE_CLIENT_SECRET` | GCP OAuth シークレット |

任意:

| 変数 | 説明 |
|------|------|
| `GEMINI_API_KEY` | Gemini（@google/genai）。**未設定時はモック解説を返す** |
| `GEMINI_MODEL` | 既定 `gemini-3.5-flash-lite` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob。**未設定時は data URL を DB に保存（開発用）** |

#### Google OAuth（GCP）設定

1. [Google Cloud Console](https://console.cloud.google.com/) → プロジェクト作成
2. **OAuth 同意画面**（外部）: スコープ `email`, `profile`, `openid`
3. **認証情報** → OAuth クライアント ID（ウェブ）
4. 承認済みリダイレクト URI:
   - `http://localhost:3000/api/auth/callback/google`
5. 発行された ID / シークレットを `.env.local` に貼る

### 4. DB スキーマ適用

```bash
npm run db:push
# または setup:local 内で実行済み
```

### 5. 開発サーバー

```bash
# ターミナル 2
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) → Google ログイン → ホーム（かざして解説）。

---

## スクリプト

| コマンド | 内容 |
|----------|------|
| `npm run dev` | Next.js 開発サーバー |
| `npm run build` / `start` | 本番ビルド |
| `npm run lint` | ESLint |
| `npm run db:push` | スキーマを DB に反映 |
| `npm run db:generate` | マイグレーション SQL 生成 |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:dev` | ローカル Turso サーバー (`local.db`) |
| `npm run setup:local` | `.env.local` 生成 + `db:push` |

---

## アーキテクチャ（要約）

```
Browser
  └─ Next.js (App Router)
       ├─ Better Auth ── Google OAuth (GCP)
       ├─ Server Actions (records CRUD / スキャン)
       ├─ Gemini ── OCR + やさしい／くわしい解説（任意）
       ├─ Vercel Blob ── 写真（任意・未設定時 data URL）
       ├─ Google Maps ── 旅の記録地図
       └─ Drizzle ── Turso / libSQL
            ├ users / sessions / accounts
            ├ records (photo, OCR, AI 解説, geo, memo)
            └ user_settings (furigana / mode / geo)
```

本番想定: **Vercel** ホスティング + リモート **Turso** + 同じ Better Auth / GCP OAuth。

フロー: **撮影 → OCR＋AI 解説 → 履歴保存（旅の記録帳）→ 地図で振り返り**

---

## ディレクトリ

```
src/
  app/           # ルーティング (login, scan, result, history, map, settings, api/auth)
  actions/       # Server Actions
  components/    # UI
  lib/
    auth*.ts     # Better Auth
    ai/          # Gemini スキャン
    blob.ts      # Vercel Blob
    db/          # Drizzle + schema
    domain/      # Record ドメイン
docs/            # 企画・要件・設計
prototype/       # 静的 hifi プロトタイプ（認証なし）
```

### プロトタイプ

本番 Next.js ではない。ブラウザだけで主要フローを触れる HTML/CSS/JS。

```bash
# 推奨: static server
cd prototype && python3 -m http.server 5173
# → http://localhost:5173
```

詳細: [`prototype/README.md`](prototype/README.md)

---

## トラブルシュート

| 症状 | 対処 |
|------|------|
| Google ログイン失敗 | リダイレクト URI が `.../api/auth/callback/google` か確認。CLIENT_ID/SECRET の再確認 |
| `TURSO_DATABASE_URL が未設定` | `.env.local` を作成し Next を再起動 |
| DB 接続失敗 | `npm run db:dev` が起動中か確認 |
| `drizzle-kit` が auth token を要求 | `TURSO_AUTH_TOKEN=local-dev` を設定 |
| DB テーブルなし | `npm run db:push` |
| Cookie が効かない | `BETTER_AUTH_URL` と実際のオリジンを一致させる |
| 解説がモックのまま | `GEMINI_API_KEY` を設定して再起動 |
| 写真が data URL のまま | 本番では `BLOB_READ_WRITE_TOKEN` を設定 |
