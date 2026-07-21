# HTML化仕様書(全エージェント共通・厳守)

docs-template/*.md(24文書)を HTML 化する際の共通仕様。デザインは assets/base.css に準拠。
assets/base.css・assets/nav.js・base.html は**変更禁止**。base.js(mermaid)は新規ページで**読み込まない**。

## ファイル対応(md → html)

md のディレクトリ・ファイル名をそのまま `.html` に変える。出力先は `docs-template/html/` 配下。
例: `docs-template/01_要件定義/01_プロジェクト概要.md` → `docs-template/html/01_要件定義/01_プロジェクト概要.html`

## ページ順序(prev/next 用。この順で前後リンクを張る)

| # | パス | タイトル | フェーズ |
|---|---|---|---|
| 0 | index.html | ドキュメント・インデックス | - |
| 1 | 01_要件定義/01_プロジェクト概要.html | プロジェクト概要 | 01 要件定義 |
| 2 | 01_要件定義/02_ペルソナ・ユーザーストーリー.html | ペルソナ・ユーザーストーリー | 01 要件定義 |
| 3 | 01_要件定義/03_機能要件.html | 機能要件 | 01 要件定義 |
| 4 | 01_要件定義/04_非機能要件.html | 非機能要件 | 01 要件定義 |
| 5 | 02_基本設計/01_システム構成.html | システム構成 | 02 基本設計 |
| 6 | 02_基本設計/02_用語集.html | 用語集 | 02 基本設計 |
| 7 | 02_基本設計/03_機能設計.html | 機能設計 | 02 基本設計 |
| 8 | 02_基本設計/04_画面設計.html | 画面設計 | 02 基本設計 |
| 9 | 02_基本設計/05_DB設計.html | DB設計(論理) | 02 基本設計 |
| 10 | 02_基本設計/06_API設計.html | API設計 | 02 基本設計 |
| 11 | 02_基本設計/07_認可設計.html | 認可設計 | 02 基本設計 |
| 12 | 02_基本設計/adr/0000_ADRテンプレート.html | ADR テンプレート | 02 基本設計 |
| 13 | 02_基本設計/adr/0001_技術スタック(テンプレート既定).html | ADR-0001 技術スタック | 02 基本設計 |
| 14 | 03_詳細設計/01_処理設計.html | 処理設計 | 03 詳細設計 |
| 15 | 03_詳細設計/02_テーブル定義.html | テーブル定義 | 03 詳細設計 |
| 16 | 03_詳細設計/03_単体テスト観点.html | 単体テスト観点 | 03 詳細設計 |
| 17 | 04_テスト/01_テスト計画.html | テスト計画 | 04 テスト |
| 18 | 04_テスト/02_結合テストケース.html | 結合テストケース | 04 テスト |
| 19 | 04_テスト/03_総合テストケース.html | 総合テストケース | 04 テスト |
| 20 | 04_テスト/04_受け入れテストシナリオ.html | 受け入れテストシナリオ | 04 テスト |
| 21 | 05_リリース/01_リリース計画.html | リリース計画 | 05 リリース |
| 22 | 05_リリース/02_リリースノート.html | リリースノート | 05 リリース |
| 23 | 06_運用/01_監視・障害対応.html | 監視・障害対応 | 06 運用 |
| 24 | 06_運用/02_バックアップ・メンテナンス.html | バックアップ・メンテナンス | 06 運用 |

- ページ1の前は index.html(タイトル「ドキュメント・インデックス」)。
- ページ24の次は `<span class="page-nav-item page-nav-next is-disabled">`(リンクなし、タイトル「最終ページ」)。
- href はそのページ自身のディレクトリからの相対パスで書く(例: `01_要件定義/04_…html` → 次は `../02_基本設計/01_システム構成.html`)。

## {{ROOT}} の置換

- index.html: `./`
- `01_要件定義/`〜`06_運用/` 直下: `../`
- `02_基本設計/adr/`: `../../`

## ページ骨格(全ページ共通)

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>【文書タイトル】 ｜ {{PROJECT_NAME}} 設計書</title>
<meta name="description" content="【1行説明】">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{{ROOT}}assets/base.css">
</head>
<body>
<div class="wrap">
  【サイドバー(下記の正本をそのまま使用)】
  <main>
    <div class="hero">
      <div class="kicker">【フェーズ名 例: 01 要件定義 · 01/04】</div>
      <h1>【文書タイトル】</h1>
      <p class="lede">【md冒頭の目的1行】</p>
    </div>
    <div class="prose">
      【変換した本文】
    </div>
    <nav class="page-nav">
      <a class="page-nav-item" href="【前ページ】"><span class="page-nav-dir">← 前</span><span class="page-nav-title">【前タイトル】</span><span class="page-nav-phase">【前フェーズ】</span></a>
      <a class="page-nav-item page-nav-next" href="【次ページ】"><span class="page-nav-dir">次 →</span><span class="page-nav-title">【次タイトル】</span><span class="page-nav-phase">【次フェーズ】</span></a>
    </nav>
    <div class="foot">{{PROJECT_NAME}} 設計書雛形 · 正本は Markdown(docs-template/) · <a href="{{ROOT}}index.html">インデックス</a></div>
  </main>
</div>
<dialog class="zoom-dlg" id="zoomDlg">
  <div class="zoom-bar">
    <span class="title">図解</span>
    <button type="button" data-z="out" title="縮小">−</button>
    <button type="button" data-z="in" title="拡大">＋</button>
    <button type="button" data-z="reset" title="全体表示">リセット</button>
    <button type="button" data-z="close" title="閉じる">閉じる ✕</button>
  </div>
  <div class="zoom-stage" id="zoomStage"></div>
</dialog>
<script src="{{ROOT}}assets/nav.js" defer></script>
</body>
</html>
```

`{{PROJECT_NAME}}` は雛形のプレースホルダとして**そのまま残す**(置換しない)。

## サイドバー正本({{ROOT}} を置換し、自ページに `class="active"`、自フェーズの div に `is-current` を追加)

```html
<aside id="sidePanel">
  <div class="side-header">
    <button type="button" class="side-toggle" id="sideToggle" aria-controls="sidePanel" aria-expanded="true" aria-label="メニューを閉じる" title="メニューを閉じる"><span class="hamburger" aria-hidden="true"><span></span><span></span><span></span></span></button>
    <div class="side-header-text">
      <div class="brand"><a href="{{ROOT}}index.html">設計書雛形</a><small>{{PROJECT_NAME}} / ap-template-v4</small></div>
      <div class="side-title"><a href="{{ROOT}}index.html">{{PROJECT_NAME}}</a></div>
    </div>
  </div>
  <nav class="side-nav" aria-label="ドキュメント一覧">
    <div class="phase">
      <span class="phase-label"><a href="{{ROOT}}index.html#01_要件定義">01 要件定義</a></span>
      <ol>
        <li><a href="{{ROOT}}01_要件定義/01_プロジェクト概要.html"><span class="n">01</span>プロジェクト概要</a></li>
        <li><a href="{{ROOT}}01_要件定義/02_ペルソナ・ユーザーストーリー.html"><span class="n">02</span>ペルソナ・ユーザーストーリー</a></li>
        <li><a href="{{ROOT}}01_要件定義/03_機能要件.html"><span class="n">03</span>機能要件</a></li>
        <li><a href="{{ROOT}}01_要件定義/04_非機能要件.html"><span class="n">04</span>非機能要件</a></li>
      </ol>
    </div>
    <div class="phase">
      <span class="phase-label"><a href="{{ROOT}}index.html#02_基本設計">02 基本設計</a></span>
      <ol>
        <li><a href="{{ROOT}}02_基本設計/01_システム構成.html"><span class="n">01</span>システム構成</a></li>
        <li><a href="{{ROOT}}02_基本設計/02_用語集.html"><span class="n">02</span>用語集</a></li>
        <li><a href="{{ROOT}}02_基本設計/03_機能設計.html"><span class="n">03</span>機能設計</a></li>
        <li><a href="{{ROOT}}02_基本設計/04_画面設計.html"><span class="n">04</span>画面設計</a></li>
        <li><a href="{{ROOT}}02_基本設計/05_DB設計.html"><span class="n">05</span>DB設計(論理)</a></li>
        <li><a href="{{ROOT}}02_基本設計/06_API設計.html"><span class="n">06</span>API設計</a></li>
        <li><a href="{{ROOT}}02_基本設計/07_認可設計.html"><span class="n">07</span>認可設計</a></li>
        <li><a href="{{ROOT}}02_基本設計/adr/0000_ADRテンプレート.html"><span class="n">A0</span>ADR テンプレート</a></li>
        <li><a href="{{ROOT}}02_基本設計/adr/0001_技術スタック(テンプレート既定).html"><span class="n">A1</span>ADR 技術スタック</a></li>
      </ol>
    </div>
    <div class="phase">
      <span class="phase-label"><a href="{{ROOT}}index.html#03_詳細設計">03 詳細設計</a></span>
      <ol>
        <li><a href="{{ROOT}}03_詳細設計/01_処理設計.html"><span class="n">01</span>処理設計</a></li>
        <li><a href="{{ROOT}}03_詳細設計/02_テーブル定義.html"><span class="n">02</span>テーブル定義</a></li>
        <li><a href="{{ROOT}}03_詳細設計/03_単体テスト観点.html"><span class="n">03</span>単体テスト観点</a></li>
      </ol>
    </div>
    <div class="phase">
      <span class="phase-label"><a href="{{ROOT}}index.html#04_テスト">04 テスト</a></span>
      <ol>
        <li><a href="{{ROOT}}04_テスト/01_テスト計画.html"><span class="n">01</span>テスト計画</a></li>
        <li><a href="{{ROOT}}04_テスト/02_結合テストケース.html"><span class="n">02</span>結合テストケース</a></li>
        <li><a href="{{ROOT}}04_テスト/03_総合テストケース.html"><span class="n">03</span>総合テストケース</a></li>
        <li><a href="{{ROOT}}04_テスト/04_受け入れテストシナリオ.html"><span class="n">04</span>受け入れテストシナリオ</a></li>
      </ol>
    </div>
    <div class="phase">
      <span class="phase-label"><a href="{{ROOT}}index.html#05_リリース">05 リリース</a></span>
      <ol>
        <li><a href="{{ROOT}}05_リリース/01_リリース計画.html"><span class="n">01</span>リリース計画</a></li>
        <li><a href="{{ROOT}}05_リリース/02_リリースノート.html"><span class="n">02</span>リリースノート</a></li>
      </ol>
    </div>
    <div class="phase">
      <span class="phase-label"><a href="{{ROOT}}index.html#06_運用">06 運用</a></span>
      <ol>
        <li><a href="{{ROOT}}06_運用/01_監視・障害対応.html"><span class="n">01</span>監視・障害対応</a></li>
        <li><a href="{{ROOT}}06_運用/02_バックアップ・メンテナンス.html"><span class="n">02</span>バックアップ・メンテナンス</a></li>
      </ol>
    </div>
  </nav>
  <div class="side-meta">全 24 文書 + インデックス<br>正本: Markdown(docs-template/)</div>
</aside>
```

## md → HTML 変換ルール

| md | HTML |
|---|---|
| 先頭 h1 | hero の h1(prose には入れない) |
| h2 / h3 | `<h2>` / `<h3>`(装飾は CSS が付ける) |
| HTMLコメントの記入ガイド | `<div class="callout"><p class="callout-title">記入ガイド</p><p>…</p></div>`(prose 冒頭に1つへ集約) |
| テーブル | `<div class="tblwrap"><table>…</table></div>`。th は `scope="col"` |
| `- [ ] 項目` | `<li>☐ 項目</li>` |
| blockquote | `<blockquote><p>…</p></blockquote>` |
| インラインコード | `<code>` |
| `{{プレースホルダ}}` | そのままテキストで残す |
| Mermaid コードブロック | 下記の図解 figure に置換(Mermaid は使わない) |

図解の埋め込み(nav.js がクリック拡大を自動で付ける):

```html
<figure class="diagram">
  <figcaption>【図タイトル】</figcaption>
  <img src="{{ROOT}}assets/diagrams/【ファイル名】.svg" alt="【図の説明】">
  <p class="zoom-hint">クリックで拡大</p>
</figure>
```

## 図解ファイル割当(assets/diagrams/ に配置予定。この名前で参照する)

| ファイル | 内容 | 使用ページ |
|---|---|---|
| vmodel.svg | V字モデル対応図 | index.html, 04_テスト/01_テスト計画.html |
| system-architecture.svg | 全体構成図 | 02_基本設計/01_システム構成.html |
| startup-order.svg | 起動順序 | 02_基本設計/01_システム構成.html |
| cicd-flow.svg | CI/CDフロー | 02_基本設計/01_システム構成.html |
| repo-flow.svg | リポジトリ運用フロー | 02_基本設計/01_システム構成.html |
| screen-flow.svg | 画面遷移図雛形 | 01_要件定義/03_機能要件.html, 02_基本設計/04_画面設計.html |
| er-example.svg | ER図(example) | 02_基本設計/05_DB設計.html |
| process-flow.svg | 処理フロー雛形 | 03_詳細設計/01_処理設計.html |
| state-machine.svg | 状態遷移図(例) | 03_詳細設計/01_処理設計.html |
| sequence-example.svg | シーケンス図(例) | 03_詳細設計/01_処理設計.html |

## 文体(stop-slop)

- である調または体言止め。前置き・冗長表現(「〜することができます」等)・絵文字禁止
- lede は1文。見出しの直後に要約文を足さない(md にある文のみ変換)
- md の内容を落とさず、飾らず変換する。独自の解説文を追加しない
