# 撮るほど — エージェントチーム構成

**更新日**: 2026-07-20  
**方式**: Architect-as-Orchestrator  

## 現行スタック（設計の正）

**Next.js + Vercel + Turso + Better Auth + Google OAuth (GCP) + Vercel Blob + Gemini + MapLibre** — ADR-0003  
共有ブリーフ: `docs/_spec/PRODUCT_BRIEF.md`  
企画書: `docs/00. 企画書/README.md`

## チーム編成（初期成果物）

| 役割 | 担当 | 成果物 | 並列 |
|------|------|--------|------|
| Architect | 本セッション | PRODUCT_BRIEF、方針、検証・統合 | — |
| Requirements | subagent | `docs/01_要件定義/*.html` + `docs/index.html` ブランド | Wave 1 |
| Basic Design | subagent | `docs/02_基本設計/*.html` + ADR-0003 更新 | Wave 1 |
| Detailed Design | subagent | `docs/03_詳細設計/*.html` | Wave 1 |
| Prototype | subagent | `prototype/` インタラクティブ UI | Wave 1 |

## 依存関係

```
PRODUCT_BRIEF（Architect）
    ├── Requirements  ─┐
    ├── Basic Design  ─┼─ 並列（共有ファイルなし）
    ├── Detailed Design┤
    └── Prototype     ─┘
Architect: 統合レビュー → 必要なら修正レーン
```

## 実装チーム（2026-07-20 完了）

| レーン | 成果 |
|--------|------|
| Architect | sorosoro 同型アーキ確定・統合ビルド |
| Foundation | package / auth / db / middleware / schema |
| Backend | records actions / Claude+mock / Blob |
| UI Core | login / home / settings |
| UI Scan | scan / result / failed / partial |
| UI Map | history / map (MapLibre) |
| Docs | README / eslint / drizzle init |

詳細: `docs/_spec/IMPLEMENTATION_TEAM.md`

## 次レーン

| フェーズ | 推奨 |
|----------|------|
| 受け入れテスト・運用文書の toruhodo 追従 | Design / QA |
| Google OAuth / Turso 本番配線 | 手元セットアップ |
| AI プロンプト・OCR 精度チューニング | Architect + implementer |
| アーキ変更前 | fable-advisor |
