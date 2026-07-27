# 撮るほど — 課金設計チーム編成と結論

**作成日**: 2026-07-26  
**更新日**: 2026-07-26（Open Questions 全件確定・モデル `gemini-3.5-flash-lite`）  
**方式**: Architect-as-Orchestrator（最高責任者 = Claude Fable 5、サブエージェント並列）  
**成果物正本**: `docs/_spec/BILLING_DESIGN.md`

## チーム編成

| ID | 役割 | 担当範囲 | 実行 |
|----|------|----------|------|
| A0 | Architect（Fable 5） | 要件分解・共通前提の決定・衝突裁定・統合執筆・品質ゲート | 本体セッション |
| M1 | product-billing | プラン設計・無料枠・仮価格・課金モデル比較・解約時データ方針 | 並列サブエージェント |
| M2 | stripe-architect | Checkout / Portal / Webhook / Customer 同期・セキュリティ・env・落とし穴 | 並列サブエージェント |
| M3 | data-schema | Drizzle スキーマ・状態機械・冪等性・enforcement 挿入点・マイグレーション | 並列サブエージェント |
| M4 | ux-legal-jp | 課金 UI フロー・文言・特商法表記・改正特商法・価格表示・運用 | 並列サブエージェント |
| M5 | design-critic | 統合後ドキュメントの最終レビュー・抜け穴指摘 | 統合後に実行 |

A0 が全員に共通前提（hosted Checkout + Portal / feature flag / サーバー側ゲート / Turso+Drizzle / Better Auth userId ↔ Stripe Customer 紐付け)を配布し、各自が独立に設計 → A0 が裁定・統合 → M5 レビューを反映（flag は最終的に `BILLING_MODE` 3 値へ改訂。R-8）。

## 各メンバーの結論サマリ

### M1 product-billing

- **Free /「撮るほどプラス」の 2 プラン制**。売るのは機能差ではなく「回数を気にしない自由」。Free はスキャン 15 回/月 + チャット 3 往復/記録（KPI の週1散歩×2〜3枚が枠内）。保存・閲覧・地図・ルビ・くわしいは全プラン無制限。
- **価格 月額 480 円（税込）確定**。年額 4,800 円は第 2 弾。趣味系アプリ実勢「月 500 円帯」の直下、原価上限を上回る粗利。
- **最重要発見**: 原価はトークンではなく **Google Search grounding（約 2.1 円/回）が 10〜20 倍支配的**。事業主確定により **チャット grounding 既定 OFF・スキャンのみ ON（D-24）**。AI モデルは **`gemini-3.5-flash-lite`（D-25）**。
- 課金モデル比較: サブスク◎採用 / 従量×（撮影をためらわせ KPI 直撃）/ クレジット△将来併用（追加回数券・ギフト）/ 買い切り×（継続原価と非整合）。
- 解約時方針「思い出は人質に取らない」: 記録は消さず閲覧無制限、新規作成のみ Free 枠に戻す。

### M2 stripe-architect

- **hosted Checkout + hosted Portal で自前カード UI ゼロ**（PCI SAQ A、JP 決済要件を Stripe に委譲）。クライアントに Stripe.js 不要、`NEXT_PUBLIC_` の Stripe 変数ゼロ。
- **webhook 設計の核**: イベント payload を状態として信用せず「同期しろという通知」として扱い、`subscriptions.retrieve()` の **fetch-fresh** で上書き。到着順序問題を原理的に排除。非 2xx 応答 → Stripe の 3 日再送が第一のリカバリ、日次 reconcile（Vercel Cron）が保険。
- entitlement 写像: `active` / `trialing` / `past_due` = 有効。past_due の猶予は Smart Retries の「最終失敗で cancel」設定で自動有限化（独自タイマー不要）。
- Customer は初回 Checkout 時 lazy 作成 + DB 調停で並行重複防止 + `client_reference_id` を命綱に。
- App Router / Vercel 固有の落とし穴を列挙: raw body は `req.text()` 一発（bodyParser 神話不要）、Preview の Deployment Protection が webhook を 401 にする、JPY は zero-decimal、Basil API で `current_period_end` が SubscriptionItem へ移動（要検証)、`{CHECKOUT_SESSION_ID}` はリテラルで渡す、等。
- webhook / reconcile はフラグ OFF でも稼働継続（OFF 期間のイベント取りこぼし防止。最終形では全データ削除時の解約連動も含めモード非依存に拡張 R-9）。

### M3 data-schema

- **追加 4 テーブルのみで既存テーブル無変更**（`stripe_customers` / `subscriptions` / `usage_counters` / `stripe_webhook_events`）。追加専用マイグレーション 1 本。ロールバック第一手段はフラグ OFF。
- subscriptions は「sub_xxx = PK の 1 行最新・履歴なし」。再加入時の順不同（旧 deleted と新 created の前後）に強い。payload 列は持たない（Stripe 側で 30 日再取得可能）。
- **冪等性**: eventId PK への INSERT を原子的クレームに、`event.created` 比較の `setWhere` 付き UPSERT で順不同破棄、`processedAt` null でクラッシュ検出。インタラクティブ txn 不使用（libSQL 制約）。
- **使用量ゲート**: increment-first の atomic UPSERT + RETURNING で race によるすり抜けゼロ。Gemini 失敗は返金・partial は消費。既存 rate-limit（60 秒窓・乱用防止）と usage（月次・課金）の二層分離。
- `records.ts` への挿入点を現行行番号で特定（createScanAction L136-138 間、chatAboutRecordAction L363-365 間、deleteAllUserDataAction L544-546 間）。
- 全データ削除は **Stripe cancel 成功を先行条件**（孤児サブスク防止）。usage_counters は削除しない（無料枠リセット悪用防止）。

### M4 ux-legal-jp

- 設定 S-07 に「プラン」セクション追加（Free / plus 有効 / 解約予約 / past_due の 4 状態）。**Checkout 前にアプリ内「申込内容の確認」画面を必ず挟む**（改正特商法 12条の6 の法定 6 項目を集約。Checkout 単独では提供時期・解約事項が不足しうるため安全側）。
- ペイウォールは「責めない・2 択・大きい文字」。無料で回復することを課金訴求より先に書く。主ボタンは「申し込む」でなく「見る」。実文言まで作成済み（BILLING_DESIGN §9）。
- 特商法表記ページ雛形を作成。個人開発者の住所・電話は「請求があったら遅滞なく開示」方式が条件付きで可（開示体制必須・**要専門家確認**）。
- 価格は全箇所「月額◯円（税込）」統一、Stripe price は `tax_behavior: inclusive`。領収書は Stripe receipt + Portal で足り、BtoC ではインボイス通常不要。
- 無料トライアルは当面なしを推奨（「知らないうちに課金」事故の最大要因）。価格改定は適用 30 日以上前（推奨 60 日前）通知。解約導線を申込より深くしない・引き止め画面を挟まない。
- 同一タブ遷移（PWA/iOS standalone の戻り導線）、success 戻り時の即時反映を UX 要件として提起 → A0 裁定で採用（下記）。

### M5 design-critic

統合後の正本を実コード（records.ts / schema.ts / middleware.ts / vercel.json / auth-session.ts / domain/record.ts）と突き合わせて敵対的レビュー。**BLOCKER 3・MAJOR 6・MINOR 5 を検出し、全件を正本に反映済み**。

| 深刻度 | 指摘（要旨） | 反映先 |
|--------|-------------|--------|
| BLOCKER B-1 | チャットゲートが未保存（pending）経路で完全バイパス可能。履歴はクライアント申告のため空を送れば無制限 = 認証済み汎用 LLM プロキシ化 | §7.3 を月次プール（実ゲート）+ 記録単位（UX）の二層に全面改訂（D-11） |
| BLOCKER B-2 | 全データ削除の Stripe 解約先行が env フラグでガードされ、OFF ロールバック中に孤児サブスク量産 | §6.6 を「subscriptions の行有無で判断・モード非依存」に変更（D-18） |
| BLOCKER B-3 | 2 値フラグでは Phase 0（計測のみ）が成立せず、ON 切替月の当月カウントも欠落 | `BILLING_MODE = off / meter / enforce` の 3 値に改訂（§7.0、D-13） |
| MAJOR M-1 | 履歴の `slice(-40)` により plus の「30 往復/記録」は永遠に到達しない死文 | plus の記録単位上限を廃止（防壁は月次プール 900）。前提条件を §7.3 に明記 |
| MAJOR M-2 | ゲートなしの saveRecordAction で記録を複製するたび記録単位の枠が回復 | 月次プールが防壁（B-1 と同解。R-3 裁定を更新） |
| MAJOR M-3 | past_due バックストップ「期間末+7日」は Stripe が周期を進めるため実際は約 37 日 | 起点を `currentPeriodStart` に変更・スキーマに列追加（§6.4、D-21) |
| MAJOR M-4 | 二重サブスク防止が Session 作成時 check のみ。放置セッションの後日完了で二重課金成立 | `expires_at` 30 分 + sync/reconcile の重複検知・自動 cancel（§5.4/§5.5、D-22） |
| MAJOR M-5 | 降格月に plus 時代の消費で即ロックアウトし、§4/§9.6 の文言と矛盾 | 「降格月は残 0 になり得る」仕様に統一し文言を修正（D-23） |
| MAJOR M-6 | 返金挿入点「failed 分岐」が実コードに存在しない。`forceStatus` が悪用経路 | §7.4 を「分岐の新設が必須」に書き分け、forceStatus は本番無視 |
| MINOR m-1〜m-5 | エラーコード表示規約 / クレーム解放 delete の条件 / E2E ③の期待値 / ダッシュボード手動設定の runbook 化 / RENEWAL_GRACE 48h 化 | §8.1 / §6.3 / §16 / §5.7 / §6.4 に反映 |

**M5 総評**: webhook 冪等・fetch-fresh・increment-first の中核設計は堅い。事故の芽は「チャットゲートが実コードの pending 経路と履歴 truncation を見ていない」「フラグ 2 値に 3 つの意味を背負わせている」の 2 系統に集中しており、反映後は実装に進める。

## A0 の裁定記録（メンバー間の衝突と解決）

| # | 衝突 | 裁定 |
|---|------|------|
| R-1 | プラン呼称が「プラス」（M1）と「プレミアム」（M2/M4）で分裂 | 表示名「撮るほどプラス」・内部識別子 `plus` に全系統統一（D-02） |
| R-2 | success 戻りの扱い: M2「webhook のみが正・ポーリング楽観表示」 vs M4「戻り時に即時反映」 | 両立: success 戻りで `session_id` → API retrieve → `client_reference_id` 検証 → **webhook と同一の冪等 sync 関数**を実行。付与根拠は常に Stripe API の正データ（D-05） |
| R-3 | チャット上限: M1「3 往復/記録」 vs M3「月次カウンタ metric=chat」 | M1 のプラン定義を優先し、`chatMessages` 長による記録単位判定に簡素化。usage_counters は scan のみ（D-11） |
| R-4 | Free スキャン上限: M1「15 回」 vs M4 文言例「10 回」 | 15 回に統一（M4 の数値はプレースホルダと判断） |
| R-5 | 保存件数ゲート: M3 が saveRecordAction 用 COUNT 判定を設計 vs M1「保存は無制限」 | M1 優先で保存ゲートは導入しない。M3 の COUNT 方式は将来必要時の参考として §7.4 に注記（D-03） |
| R-6 | past_due 猶予: M2「Smart Retries 設定で有限化」 vs M3「期間末 + 7 日で強制失効」 | 両立: 写像は M2、時間バックストップは M3。ただし M5 指摘によりバックストップ起点は `currentPeriodStart` に修正（D-09 / D-21） |
| R-7 | チャット実ゲート: R-3 の初期裁定（記録単位のみ・カウンタ不要）が M5 の B-1/M-2 で破られた | 初期裁定を撤回し、M3 の月次カウンタ案を復活・併用（表示は記録単位、強制は月次プール。D-11） |
| R-8 | feature flag: 全員の前提だった 2 値 `BILLING_ENABLED` が M5 の B-3 で Phase 0 と矛盾 | `BILLING_MODE = off / meter / enforce` の 3 値へ改訂（D-13） |
| R-9 | 削除時の解約連動: M3 案は env フラグでガードしていた（M5 の B-2） | subscriptions の行有無で判断しモード非依存に（D-18） |

## 事業主確定（2026-07-26）

Open Questions Q-01〜Q-11 は **ベストプラクティス全採用** で確定済み（BILLING_DESIGN §15）。要約:

| 項目 | 確定 |
|------|------|
| チャット grounding | OFF（スキャンのみ ON） |
| AI モデル | `gemini-3.5-flash-lite` |
| Free 枠 | スキャン 15 回/月（Phase 0 で数値のみ見直し可） |
| 価格 | 月額 480 円（税込）。年額は第 2 弾 |
| 決済 | カード + Apple/Google Pay のみ初期 |
| 特商法 | 住所・電話は全記載原則 |
| 全データ削除 | 即時 cancel・返金なし |
| 見送り | 画質差別化・ギフト/家族・初期特別価格・コンビニ等 |

## 残課題（判断ではない作業）

1. **法務の専門家確認** — 特商法・利用規約の最終文言（方針は全記載・申込確認画面で確定済み）。
2. **技術的要検証** — Stripe SDK の period フィールド位置、Drizzle `setWhere` + libSQL、past_due テストクロック、E2E ③。
3. **Phase 0 計測** — Free 15 回の数値微調整の要否。
4. 特商法ページの **実値記入**（事業者名・住所・電話・メール・動作環境）。
5. 課金 PR Plan（PR-1〜8）の実装着手。
