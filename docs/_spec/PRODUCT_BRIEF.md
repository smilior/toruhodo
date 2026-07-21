# 撮るほど — 共有プロダクトブリーフ（エージェント正本）

**作成日**: 2026-07-20  
**更新日**: 2026-07-20  
**正本ソース**: `docs/00. 企画書/README.md`（UI・ドメイン・AI）  
**プロジェクトコード名**: toruhodo  
**アプリ名**: 撮るほど  
**タグライン**: かざすと、やさしく教えてくれる  

---

## 1. 一言で言うと

スマホカメラで**石碑・案内板**を撮影すると、AI が**やさしい言葉**で解説してくれる **PWA（モバイルファースト・日本語 UI）**。  
フローは **撮影 → OCR＋AI 解説 → 履歴保存（旅の記録帳）→ 地図で振り返り**。  
中高年にも読みやすい文字サイズ（本文 16px 以上）。データは **ログインユーザー単位**で **Turso** に保存し、写真は **Vercel Blob** に置く。

---

## 2. コアドメインモデル

```
Record（旅の記録）
├ id          : string (nanoid / cuid)
├ userId      : string（ログインユーザー）
├ photoUrl    : string（Vercel Blob URL）
├ title       : string（AI 生成の短い題名）
├ easyText    : string（やさしい言いかえ。プレーンまたは HTML）
├ detailText  : string（くわしい説明）
├ easyRuby    : string（やさしい＋<ruby> 付き HTML）
├ detailRuby  : string（くわしい＋<ruby> 付き HTML）
├ aiNote      : string（AI による補足・背景知識）
├ ocrRaw      : string（OCR 原文）
├ partial     : boolean（一部のみ読めた）
├ partialChars: string | null（読めた文字チップ用）
├ lat / lng   : number | null
├ placeName   : string | null
├ memo        : string | null（ユーザーメモ）
└ createdAt   : datetime

UserSettings
├ userId
├ furiganaDefault : boolean（既定 true）
├ modeDefault     : "easy" | "detail"（既定 "easy"）
└ geoEnabled      : boolean（既定 true）
```

### スキャン状態機械

```
idle → capturing → ocr → generating → done | failed | partial
```

### 結果画面ローカル状態

- `mode`: easy | detail（初期値は settings.modeDefault）
- `furigana`: on | off（初期値は settings.furiganaDefault）
- 本文切替は即時（〜200ms fade）。ルビは `rt` の表示切替でよい

---

## 3. MVP スコープ

### In（必須）

| ID | 機能 |
|----|------|
| F-00 | Google ログイン / ログアウト（Better Auth） |
| F-01 | ホーム（かざして解説 CTA・さいきんの記録） |
| F-02 | 撮影（カメラ・ギャラリー・フラッシュ UI） |
| F-03 | OCR＋AI 解説生成（やさしい／くわしい／補足／ルビ／partial・failed） |
| F-04 | 解説結果（モード切替・ふりがな・メモ・記録に残す・免責） |
| F-05 | 読み取り失敗・部分読み取り UI |
| F-06 | 旅の記録（履歴一覧・空状態） |
| F-07 | 旅の記録地図（MapLibre・ピン・位置情報オフ配慮） |
| F-08 | 設定（ふりがな／モード初期値・位置情報・データ削除・規約） |
| F-09 | クラウド永続化（Turso records + Blob 写真） |

### Out（MVP でやらない）

| ID | 内容 | 理由 |
|----|------|------|
| OUT-01 | ネイティブアプリ（App Store / Play） | PWA で十分 |
| OUT-02 | オフライン完全同期・オフライン OCR | 後続候補 |
| OUT-03 | 複数人・旅の共有アルバム | 個人アカウント単位 |
| OUT-04 | 音声読み上げ・多言語 UI | 日本語固定 |
| OUT-05 | 石碑以外の汎用ドキュメント OCR | 石碑・案内板に特化 |
| OUT-06 | 課金・サブスク | MVP 外 |

---

## 4. 画面

| ID | 画面 | パス | デザインID | 認証 |
|----|------|------|------------|------|
| S-00 | ログイン | `/login` | （未作成・shadcn） | 不要 |
| S-01 | ホーム | `/` | 1b | 要 |
| S-02 | 撮影 | `/scan` | 1c, 1d | 要 |
| S-03 | 解説結果 | `/result/:id` | 1e, 1f, 1g, 1i | 要 |
| S-04 | 読み取り失敗 | `/scan` 内 or `/result/failed` | 1h | 要 |
| S-05 | 履歴 | `/history` | 1j, 1k | 要 |
| S-06 | 地図 | `/map` | 1l | 要 |
| S-07 | 設定 | `/settings` | （未作成・shadcn） | 要 |

タブバー: ホーム / 履歴 / 地図 / 設定（4 タブ）。

---

## 5. デザイン原則

1. **やさしく教える** — 責めない失敗 UI、大きな文字、和紙×和色  
2. **1 タップで撮影へ** — ホーム主役 CTA  
3. **原文と AI 補足を一目で区別** — 古紙カード vs 薄藍カード（色＋アイコン＋ラベルの 3 重）  
4. **中高年配慮** — 本文 16px+、タップ領域 44px+、主ボタン 56px  

### 主要トークン

| トークン | Hex |
|----------|-----|
| 朱 primary | `#B9502F` |
| 朱・濃 | `#9C4327` |
| 藍 secondary | `#33566E` |
| 墨 ink | `#3A352C` |
| 生成り bg | `#F6F1E5` |
| 和紙 card | `#FDFBF4` |

- 見出し: Shippori Mincho / 本文: Zen Maru Gothic  
- ロゴ: 朱印「撮」＋ワードマーク「撮るほど」  
- 詳細: 企画書 README の Design Tokens / Screens 節を正とする  

---

## 6. 技術スタック（正・ADR-0003 を toruhodo 向けに継承）

| 層 | 採用 |
|----|------|
| フレームワーク | Next.js 16 App Router + React 19 + TypeScript |
| ホスティング | Vercel |
| DB | Turso (libSQL) + Drizzle ORM |
| 認証 | Better Auth + Google OAuth（GCP） |
| ストレージ | Vercel Blob（写真） |
| AI | Gemini（@google/genai, `gemini-3.1-flash-lite` + Google Search）1 リクエストで OCR＋解説 JSON |
| 地図 | MapLibre GL JS |
| UI | Tailwind CSS v4 + shadcn/ui + デザイントークン |
| ミューテーション | Server Actions / Route Handlers |

**実装パス**: リポジトリ root の `src/`。UI 参照・検証用に `prototype/` あり（本番コードではない）。  
**UI 正本**: `docs/00. 企画書/README.md` + `撮るほど UIデザイン.dc.html`。

### AI レスポンス契約（概要）

1 リクエストで JSON:

```json
{
  "failed": false,
  "partial": false,
  "partialChars": null,
  "ocrRaw": "...",
  "title": "...",
  "easyText": "...",
  "detailText": "...",
  "easyRuby": "<ruby>…</ruby>…",
  "detailRuby": "...",
  "aiNote": "..."
}
```

- `failed: true` → 失敗画面 1h  
- `partial: true` → 注意バナー＋読めた文字チップ 1i  
- 免責注記は結果画面に常時表示  

---

## 7. ペルソナ

| ID | 名 | 属性 | 困りごと | ニーズ |
|----|----|------|----------|--------|
| P-01 | あかり（30 代・子育て） | 家族散歩 | 難しい漢字・文言が子どもに説明できない | やさしい言いかえ＋ふりがな |
| P-02 | たけし（60 代・散歩好き） | スマホは大きめ文字派 | 案内板が読みにくい | 大きな文字・失敗しても責めない |
| P-03 | ゆい（40 代・歴史旅） | 旅行で石碑を撮る | 写真は残るが内容を忘れる | 旅の記録帳＋地図 |

---

## 8. ユーザーストーリー（MVP）

| ID | P | ストーリー | 優先 | MVP |
|----|---|------------|------|-----|
| US-00 | P-01 | Google でログインし自分の記録だけ見たい | 高 | ○ |
| US-01 | P-01 | ホームから 1 タップで撮影を始めたい | 高 | ○ |
| US-02 | P-02 | 石碑を撮るとやさしい解説が出てほしい | 高 | ○ |
| US-03 | P-01 | ふりがなの ON/OFF を切り替えたい | 高 | ○ |
| US-04 | P-03 | やさしい／くわしいを切り替えたい | 高 | ○ |
| US-05 | P-02 | うまく読めなくても次の撮り方を教えてほしい | 高 | ○ |
| US-06 | P-03 | 記録に残して後から履歴で見たい | 高 | ○ |
| US-07 | P-03 | 地図上で訪れた場所を振り返りたい | 中 | ○ |
| US-08 | P-01 | 自分のメモを書き足したい | 中 | ○ |
| US-09 | P-02 | 位置情報をオフでも記録は残したい | 中 | ○ |
| US-10 | P-01 | ふりがな・解説モードの初期値を設定したい | 低 | ○ |
| US-11 | P-03 | データを削除したい | 低 | ○ |

---

## 9. KPI

| ID | 指標 | 目標 | 時期 |
|----|------|------|------|
| KPI-01 | 初回撮影→解説表示完了率（ログイン後） | 70% 以上 | 公開 1 ヶ月 |
| KPI-02 | 解説表示後の「記録に残す」率 | 50% 以上 | 公開 1 ヶ月 |
| KPI-03 | 週 1 回以上利用した継続率 | 30% 以上 | 公開 3 ヶ月 |
| KPI-04 | 読み取り失敗後の再撮影率 | 40% 以上 | 受け入れ時参考 |

---

## 10. ドキュメント作業ルール

1. 設計書は **撮るほど現行スタックのみ** を記載する。旧プロダクト（おうち掃除ログ / sorosoro）の記述は残さない。  
2. 技術選定の正は **ADR-0003（toruhodo 向け更新版）**。  
3. `{{PROJECT_NAME}}` 表示名・ブランドは **撮るほど** / コード名 **toruhodo**。  
4. ドメイン・UI の詳細は企画書 README を優先。  
5. 日本語。表形式維持。である調または体言止め。  
6. HTML ページ骨格・サイドバーは既存 `docs/**/*.html` の構造を踏襲し、ブランド表記を撮るほどに置換する。  
7. `assets/base.css`・`assets/nav.js` は変更禁止。  
|
