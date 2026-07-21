# 撮るほど — インタラクティブ・プロトタイプ

本番 Next.js ではない。**ブラウザだけで**主要フローを触れる高忠実度 HTML/CSS/JS プロトタイプ。

デザイン準拠: 和紙×和色・Shippori Mincho・Zen Maru Gothic・朱 `#B9502F`

## 開き方

```bash
# 方法1: そのまま開く（カメラ・MapLibre は file:// 制限あり）
open prototype/index.html

# 方法2: 簡易 static server（推奨）
cd prototype && python3 -m http.server 5173
# → http://localhost:5173
```

カメラ（`getUserMedia`）と地図タイルは **http(s) オリジン** で開くのが確実。

## 画面一覧

| 画面 | ハッシュ | デザインID | 内容 |
|------|----------|------------|------|
| ホーム | `#home` | 1b | 朱印ロゴ・かざして解説 CTA・さいきんの記録・タブ |
| 撮影 | `#scan` | 1c | ダーク背景・ガイド枠・シャッター |
| ローディング | （撮影内） | 1d | 読み取り → 解説の 2 段階（タイマー模擬） |
| 結果 | `#result/:id` | 1e/1f/1g | モード切替・ふりがな・メモ・記録に残す・免責 |
| 失敗 | `#failed` | 1h | 責めない UI・撮り方のコツ |
| 部分読み取り | `#result/:id` | 1i | 注意バナー・読めた文字チップ |
| 履歴 | `#history` | 1j / 1k | 一覧 / 空状態 |
| 地図 | `#map` | 1l | MapLibre（失敗時は静的マップ）+ ピン |
| 設定 | `#settings` | — | ふりがな/モード初期値・位置情報・データ削除 |

タブ: **ホーム / 履歴 / 地図 / 設定**

## モック分岐の操作（撮影）

| 操作 | 結果 |
|------|------|
| シャッター **タップ** | 成功（一里塚の解説）→ 1e 系 |
| シャッター **長押し**（約 0.55 秒） | 部分読み取り（馬頭観音）→ 1i |
| シャッター **ダブルタップ** | 読み取り失敗 → 1h |
| ギャラリーから画像選択 | ランダム（成功多め / 部分 / 失敗） |

ローディングは約 1.4 秒（OCR）+ 1.6 秒（解説生成）で自動遷移。キャンセル可。

## localStorage キー設計

| キー | 内容 |
|------|------|
| `toruhodo.records` | 旅の記録配列 `Record[]` |
| `toruhodo.settings` | `{ furiganaDefault: boolean, modeDefault: "easy"\|"detail", geoEnabled: boolean }` |
| `toruhodo.seeded` | 初回シード投入済みフラグ（`"1"`）。データ削除後は再シードしない |

### Record 概形

```js
{
  id, title, placeName, lat, lng,
  easyText, easyRuby, detailText, detailRuby,
  aiNote, aiNoteRuby, aiNoteDetail, aiNoteDetailRuby,
  ocrRaw, partial, partialChars, memo,
  photoLabel, photoDataUrl, createdAt
}
```

- 「**記録に残す**」→ `toruhodo.records` に保存 → 履歴・ホーム・地図に反映
- メモは保存済みなら変更時に自動永続化
- 設定のトグルは即 `toruhodo.settings` に保存
- 初回訪問時のみシード履歴 4 件を投入

## 振る舞いメモ

- 結果の **やさしい ⇄ くわしい** / **ふりがな** は即時切替（約 200ms フェード）
- 免責注記は結果画面に常時表示
- 位置情報オフ（設定）だと新規スキャン結果に場所を付けない
- モバイル幅 375px 基準、`max-width: 480px` 中央寄せ

## 本番との差分

| 項目 | プロトタイプ | 本番（予定） |
|------|--------------|--------------|
| フレームワーク | 素の HTML/CSS/JS | Next.js App Router |
| 認証 | なし | Better Auth + Google |
| 永続化 | localStorage | Turso + Vercel Blob |
| OCR / 解説 | モック固定文 | Claude Vision API |
| 地図 | MapLibre CDN + OSM タイル（失敗時 SVG） | MapLibre + 本番スタイル |
| カメラ | getUserMedia（失敗時プレースホルダ） | 同様 + エラー UX |

## ファイル構成

```
prototype/
  index.html       # エントリ
  css/tokens.css   # デザイントークン
  css/app.css      # レイアウト・コンポーネント
  js/mock-data.js  # モック解説・シード・localStorage ヘルパ
  js/app.js        # ルーティング・画面・状態
  README.md
```

## 外部 CDN

- Google Fonts（Shippori Mincho / Zen Maru Gothic / Material Symbols Rounded）
- MapLibre GL JS 4.x（unpkg）
- OpenStreetMap タイル（地図表示時）
