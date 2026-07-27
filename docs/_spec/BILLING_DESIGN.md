# 撮るほど — Stripe 課金設計（正本）

**作成日**: 2026-07-26  
**更新日**: 2026-07-26（Open Questions 全件をベストプラクティスで確定。AI モデルは `gemini-3.5-flash-lite`）  
**ステータス**: 設計確定（Open Questions 事業主確定済み）・課金実装は PR Plan 待ち（PRODUCT_BRIEF OUT-06 の解除提案を含む）  
**正本ソース**: 本書。前提は `docs/_spec/PRODUCT_BRIEF.md` / `src/lib/db/schema.ts` / `src/actions/records.ts`  
**チーム編成と各担当の結論**: `docs/_spec/BILLING_TEAM.md`

> 本書の法務章（§11）は法的助言ではなく設計上の整理である。最終判断は専門家（弁護士・税理士）確認を前提とする。

---

## 1. 目的・非目的

### 目的

- Gemini / Blob / Turso の従量原価に対し、持続可能な収益構造を作る。
- 無料体験と KPI（解説完了率 70%・保存率 50%・週1継続率 30%）を毀損せず、ヘビーユーザーから対価を得る。
- サーバー側で強制される機能ゲートと、Stripe を正とする購読状態管理を実装可能な粒度で定義する。

### 非目的

- 実装そのもの（本書は設計のみ。コード変更は PR Plan §13 に従う）。
- ネイティブアプリ内課金（IAP）対応（PWA + Stripe のみ。OUT-01 継承）。
- B2B・チーム・ギフトプラン・回数券（第 2 フェーズ以降。§15 確定事項）。
- ポイント・クレジット制の初期導入（§4 で比較の上見送り）。
- 初期リリースでの年額プラン・コンビニ払い・キャリア決済・画質によるプラン差別化。

---

## 2. マネタイズ仮説

**価値の瞬間は「散歩先で気兼ねなく撮り、その場で『へえ』と言える」こと。** ペルソナ（たけし・ゆい）は外出1回で 2〜5 枚撮る。よって売るのは個別機能ではなく「**残り回数を気にしない自由**」である。スキャン1回 = Gemini 2 コール（解析＋ルビ二段生成）、チャット1往復 = 最大2コールと、ヘビーになるほど原価が線形に増える構造であり、量ゲートは原価構造と一致する。

| 区分 | 方針 | 理由 |
|------|------|------|
| 無料 | 週1散歩ぶんのスキャン、候補質問を試せる程度のチャット | KPI 行動（週1×2〜3枚 = 月8〜12枚）が無料枠内で成立する水準 |
| 無料 | **保存・履歴・地図・検索のすべて** | 保存を止めると保存率 KPI を自傷する。「思い出は人質に取らない」 |
| 無料 | やさしい/くわしい/ルビの表示モード | 「中高年に優しい」ブランドの中核。ルビを金で売る印象は毀損リスク大 |
| 売る | スキャン回数・チャット往復の上限解放 | 原価ドライバーそのもの。熱中した人だけが払う自然な設計 |
| 売る（将来候補） | 写真の高画質保存、「散歩のしおり」PDF | Blob 原価抑制と量以外のお得感。初期は見送り |

### 原価の核心（product-billing 調査）

原価はトークンではなく **Google Search grounding（約 2.1 円/回、月 5,000 回無料枠超過後）が 10〜20 倍支配的**。

| ユーザー像 | 使用量/月 | トークンのみ | スキャン+チャットとも grounding | **採用方針（スキャンのみ grounding）** |
|-----------|----------|-------------|-------------------------------|----------------------------------------|
| Free 上限張り付き | 15 スキャン + 45 往復 | 約 9 円 | 約 135 円 | **約 40 円前後**（チャット grounding なし） |
| プラス中央値 | 40 スキャン + 80 往復 | 約 19 円 | 約 280 円 | **約 100 円前後** |
| プラスヘビー（上位5%） | 100 スキャン + 200 往復 | 約 45 円 | 約 675 円 | **約 250 円前後**（月額 480 円でも粗利が残る） |

**確定方針（D-24）**: スキャン（撮影→解説）のみ Google Search grounding を ON。チャット（ガイドへの質問）は grounding **既定 OFF**。チャットは石碑の OCR・既存解説・会話履歴を根拠にし、一般知識の補足は「推測だと分かる言い方」で足りる。原価の支配項をスキャン回数に揃え、課金ゲートと一致させる。

**AI モデル（D-25）**: 本番・ローカルとも **`gemini-3.5-flash-lite`**（`GEMINI_MODEL` 未設定時のコード既定も同名）。原価試算のトークン単価は公開料金表を参照しつつ、月次の実請求で検証する。

---

## 3. プラン定義

**2 プラン制**。表示名「**撮るほどプラス**」（「プレミアム」より柔らかく説明しやすい）。内部識別子はコード全体で `plus` に統一する。

| 機能 | 無料プラン | 撮るほどプラス |
|------|-----------|---------------|
| スキャン（撮影→解説） | **15 回/月** | **300 回/月**（UI 表記は「回数を気にせず使えます」。実質使い放題のフェアユース上限） |
| ガイドへの質問（チャット） | **各記録につき 3 往復**（月合計 45 往復のプール上限あり） | 回数を気にせず質問可（月 900 往復のフェアユース上限） |
| やさしい/くわしい切替・ルビ・AI 補足 | ○（全機能） | ○（同じ） |
| 記録の保存・履歴・地図・検索 | 無制限 | 無制限 |
| 月次リセット | JST 暦月 1 日 0:00 | 同左 |

### 上限の根拠

- **スキャン 15 回/月（確定・初期値）**: 週1継続 KPI の行動（週1外出×2〜3枚 = 月 8〜12 枚）を枠内に収め、「週2回歩く・旅行月に1日10枚」の熱中層だけが天井に当たる位置。Phase 0（`meter`）の p50/p90 で **必要なら数値だけ見直す**（方針自体は「KPI 行動のすぐ上」を維持）。
- **チャット 3 往復/記録**: `suggestedQuestions` が 3〜5 個生成されるため、候補チップを試す体験が 3 往復で成立する。月間プールではなく記録単位にするのは、「この記録であと◯回質問できます」と画面内で説明が完結し、月間残数の暗算をユーザーにさせないため。ただしサーバー側の実ゲートは月合計 45 往復（15 記録 × 3 往復相当）のプールを併設する（未保存チャット経路の防御。§7.3）。
- **見せる数字は 2 つだけ**: 「今月のスキャン残り回数」「この記録の質問残り」。複雑さはブランド毀損。

### 価格（確定）

**初期リリース: 月額 480 円（税込）のみ。**  
年額 4,800 円（税込・2ヶ月分お得）は **第 2 弾** で追加する（Stripe Price の lookup_key と seed は将来用に設計上残す。初期 UI・Checkout には出さない）。

根拠: ①チャット grounding OFF 後のヘビー原価（約250円）を上回る粗利、②日本の趣味・散歩系アプリの実勢「月 500 円帯」、③500 円の心理的天井の直下・「コーヒー1杯」で説明可能。PWA + Stripe（手数料約3.6%）でストア手数料 15〜30% を回避できる。

---

## 4. 課金モデル選定

| モデル | 適合度 | 判断 | 理由 |
|--------|--------|------|------|
| **サブスク（月額/年額）** | ◎ | **主軸に採用** | 原価が継続発生（API 従量）と整合。週1継続 KPI と収益が同じ方向を向く。「月々480円で気にせず使える」が最も説明しやすい |
| 従量課金 | × | 却下 | 1枚ごとの課金意識が撮影をためらわせ、解説完了率・継続率 KPI を直撃。単価数円で決済コスト倒れ |
| クレジット（回数券） | △ | 初期見送り・将来併用余地大 | 「追加20回 200円」の天井到達時救済、子→親のギフト回数券はペルソナ構造に適合。ただし初期からは価格体系が複雑化 |
| 買い切り | × | 却下 | 使うたび API 原価が発生する構造と根本非整合。ヘビーユーザーが永久赤字化 |

### ダウングレード / 解約時のデータ扱い

原則: **「思い出は人質に取らない」**。

| 項目 | 設計 |
|------|------|
| 保存済み記録 | 削除しない。閲覧・検索・地図・ルビ・くわしいモードすべて無期限無料 |
| チャット履歴 | 閲覧無制限。解約後の**新規質問**のみ Free の「3 往復/記録」判定に戻る（既に超過した記録は追加質問不可、履歴は読める） |
| スキャン | 解約期間末の直後から Free 判定。切替月はプラス時代の消費が月次カウンタに残るため、無料分をすでに超えていればその月の残りは 0（翌月 1 日に 15 回回復）。日割り・カウンタ補正はしない（単純さ優先。文言は §9.6） |
| 保存件数 | Free にも上限を設けないため、超過削除の概念自体が発生しない |
| 退会（全データ削除） | 既存 `deleteAllUserDataAction` どおり全削除。Stripe 解約を先行させる（§6.6） |

---

## 5. Stripe アーキテクチャ

### 5.1 方式: hosted Checkout + hosted Customer Portal

Payment Element の自前実装はしない。

- **PCI DSS スコープ最小化**: カード情報が自サーバー・自 DOM を一切通らない（SAQ A 相当）。
- **JP 決済要件の丸投げ**: 3D セキュア義務化、明細表示、消費税表記、将来の決済手段追加を Stripe 側 UI が吸収。
- **実装最小**: Server Actions 中心の構成に「URL を返してリダイレクト」の 2 アクションを足すだけ。クライアントに Stripe.js 不要、`NEXT_PUBLIC_` の Stripe 変数もゼロ。
- 解約・カード更新・領収書 DL は Portal に全委任し、サポート問い合わせの大半を無実装で処理。

### 5.2 Stripe リソース

| リソース | 値 | 備考 |
|----------|-----|------|
| Product | 「撮るほどプラス（スキャン回数たっぷり・1か月ごと自動更新）」 | 名称に分量・周期を含める（特商法 12条の6 対応 §11.2）。`metadata.app = "toruhodo"` |
| Price #1 | 月額 480 JPY、`recurring.interval: month`、`tax_behavior: "inclusive"` | `lookup_key: "toruhodo_plus_monthly"` |
| Price #2（第 2 弾） | 年額 4,800 JPY、`interval: year` | `lookup_key: "toruhodo_plus_yearly"`。**初期 seed では作成してもよいが Checkout には載せない** |
| Portal Configuration | 1 個（§9.4） | |
| Webhook Endpoint | 本番ドメイン `/api/stripe/webhook` | 購読イベントは §5.5 の一覧に絞る |

- **JPY は zero-decimal 通貨**。`unit_amount: 480` = ¥480（×100 しない）。
- **作成方法**: ダッシュボード手作業ではなく冪等 seed スクリプト `scripts/stripe-setup.mjs`（lookup_key で検索→無ければ作成→price id 出力）。テスト/本番で同一構成を再現。アプリからの参照は env の Price ID を正とする。
- **価格改定手順**: ①新 Price 作成（`transfer_lookup_key: true`）→ ②env 差し替え・再デプロイ → ③旧 Price を `active: false`（既存契約は旧価格のまま据え置き）。

### 5.3 Customer ↔ Better Auth user の紐付け

- **初回 Checkout 時の lazy 作成**。理由: ①大半のユーザーは Free のままで Customer 量産はゴミ化、②サインアップ経路を Stripe 障害に巻き込まない、③Checkout 直前ならリトライ導線が自明。
- 双方向紐付け: DB `stripe_customers`（userId PK → customerId, customerId unique）+ `Customer.metadata.userId`。webhook 側は DB を正、metadata は reconcile・障害調査用の逆引き。
- **並行 Checkout の重複防止は DB を調停者にする**:

```
getOrCreateCustomer(userId, email):
  1. SELECT stripe_customers WHERE user_id → あれば返す
  2. stripe.customers.create({ email, metadata: { userId } },
       { idempotencyKey: `cust-create-${userId}` })   // 24h 有効の保険
  3. INSERT INTO stripe_customers ... ON CONFLICT (user_id) DO NOTHING
  4. 再 SELECT。自分の INSERT が負けたら手順2の Customer をベストエフォート削除し、勝者を返す
```

- email は作成時に Better Auth の値をセット。Google OAuth 固定で変更導線がないため継続同期は不要。Portal 側の email 編集も無効化（§9.4）。
- Checkout Session に必ず `client_reference_id: userId` と `subscription_data.metadata: { userId }` を積む（マッピング欠損時の最後の命綱）。

### 5.4 Checkout フロー

Server Action で Session を作成し URL を返す → クライアントは**同一タブで** `location.href`（PWA/iOS standalone で別タブに出すと戻り導線が壊れる）。

| パラメータ | 値 |
|-----------|-----|
| `mode` | `"subscription"` |
| `customer` | `getOrCreateCustomer()` の結果（クライアントから受け取らない） |
| `client_reference_id` | `userId` |
| `line_items` | `[{ price: env の Price ID, quantity: 1 }]`（plan enum → env のサーバー側マップ） |
| `success_url` | `${APP_URL}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`（`{CHECKOUT_SESSION_ID}` はリテラルのまま渡す） |
| `cancel_url` | `${APP_URL}/settings?checkout=cancel` |
| `locale` | `"ja"` |
| `allow_promotion_codes` | `true` |
| `expires_at` | 作成から 30 分（放置セッションの後日完了による二重購読を防ぐ。既定 24h は長すぎる） |
| `custom_text.submit.message` | 「1か月ごとの自動更新です。解約はいつでもアプリの設定→プランから行えます。」（§11.2） |
| `consent_collection.terms_of_service` | `required` |
| `billing_address_collection` | `"auto"` |
| `automatic_tax` | 当面 off（内税価格運用。課税事業者化時に Stripe Tax 再検討） |

- Session 作成前に `subscriptions` を確認し、有効な契約があれば `ALREADY_SUBSCRIBED` を返して Portal へ誘導（二重サブスク防止）。

### 5.5 反映の原則: webhook を正、success 戻りは同一 sync 関数で即時反映

entitlement を書き込む経路は **`syncStripeSubscription()` ただ 1 本**に集約する。

1. **webhook（正）**: 全イベントがこの関数を通る。
2. **success 戻り（即時反映）**: `/settings?checkout=success` のサーバー処理で `session_id` から Checkout Session を retrieve → `session.client_reference_id === 現在の userId` を検証 → `session.subscription` を**同じ** `syncStripeSubscription()` に流す。付与の根拠は URL ではなく Stripe API から取得した正データであり、関数は冪等なので webhook との二重実行も安全。「払ったのに Free のまま」という最も不安な状態を原則ゼロにする（UX 要件と整合性要件の両立）。
3. **日次 reconcile（自己修復）**: Vercel Cron → `/api/stripe/reconcile`。DB の非終端 subscription を全件 retrieve して同期 + `subscriptions.list` を舐めて DB に無い契約（metadata.userId あり）を補完。「バグって 200 を返した」取りこぼしの保険。あわせて**同一 userId の有効 subscription が 2 件以上あれば警告ログを出し、新しい方を自動 cancel**する（二重課金の自己修復。返金は運用判断。sync 側でも同検知を行う）。

`syncStripeSubscription` の指針: **イベント payload を状態として信用しない。イベントは「同期しろ」という通知**。subscription id を取り出し `stripe.subscriptions.retrieve()` で現在値を再取得して upsert（fetch-fresh）。到着順序問題（created より updated が先着等）は原理的に消える。DB 層の冪等・LWW 防御は §6.3。

### 5.6 Webhook イベント一覧

`/api/stripe/webhook`（POST・`runtime = "nodejs"` 明示・署名検証のみで無認証）。

| イベント | 処理 |
|----------|------|
| `checkout.session.completed` | `client_reference_id` と `customer` で `stripe_customers` を upsert（保険）→ `session.subscription` を sync |
| `customer.subscription.created` / `updated` | sync |
| `customer.subscription.deleted` | sync（status = `canceled` として同値処理） |
| `invoice.paid` | 実 DB 更新なし。`billing_reason === "subscription_cycle"` を継続課金成功としてログ（分析用） |
| `invoice.payment_failed` | ログ + アプリ内バナーのトリガ（§9.6）。status 変化自体は subscription.updated が運ぶ |
| `customer.deleted` | `stripe_customers` の該当行を削除（ダッシュボード手動削除時の整合） |

Endpoint の `enabled_events` は上記のみに絞る（全購読は再送嵐とログ汚染のもと）。customer 不明のイベントは **no-op + warn**（退会処理後の後着 webhook 対応、§6.6）。

App Router の要点: `const payload = await req.text()` で raw body を取り `stripe.webhooks.constructEvent(payload, sig, whsec)`。Pages Router の `bodyParser: false` は不要かつ無効。DB 書き込み完了前に 200 を返さない（非 2xx は Stripe が最大3日再送 = 第一のリカバリ）。

### 5.7 テストモード / 本番切替

- SDK は `stripe` npm 最新 major を導入し、クライアント生成時に **apiVersion を明示固定**（SDK 更新と API バージョン変更を意図的な同時作業にする）。
- **注意（要検証）**: API 2025-03-31（Basil）以降、`current_period_end` は Subscription 直下から **`items.data[0].current_period_end`** に移動。固定した apiVersion の型と突き合わせて読む。
- ローカル: `stripe listen --forward-to localhost:3000/api/stripe/webhook`（表示された `whsec_` を `.env.local` へ。ダッシュボード endpoint の whsec とは別物）。`stripe trigger checkout.session.completed` で単発試験。
- Vercel Preview は Deployment Protection により Stripe からの webhook が 401 になる。webhook 試験は「ローカル（stripe listen）+ 本番ドメインのテストモード endpoint」の 2 択と割り切る。
- 本番切替手順: live キー投入 → 本番 endpoint 作成（live whsec）→ seed スクリプトを live 実行 → **ダッシュボード手動設定**（①顧客向けメール「支払い成功時に領収書を送信」ON ②Smart Retries「最終リトライ失敗時に subscription を cancel」③Portal Configuration §9.4。いずれも seed スクリプト対象外のため PR-8 runbook の必須チェック項目）→ 実カードで1周確認 → `BILLING_MODE=enforce`。

---

## 6. ドメインモデルと DB スキーマ案

追加 4 テーブルのみ。**既存テーブルは無変更**（FK は新テーブル側から `users.id` を参照するだけ）。

### 6.1 Drizzle スキーマ（`src/lib/db/schema.ts` 末尾に追記）

import に `primaryKey, uniqueIndex` を追加。

```ts
// --- Billing: Stripe（BILLING_MODE が meter / enforce のときのみコードから参照 §7.0） ---

export const stripeCustomers = sqliteTable(
  "stripe_customers",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    // webhook は customerId 起点で userId を引くため双方向に一意
    uniqueIndex("stripe_customers_customer_id_uq").on(t.stripeCustomerId),
  ],
);

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    /** sub_xxx。1サブスク=1行、常に最新状態へ上書き */
    stripeSubscriptionId: text("stripe_subscription_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Stripe準拠: incomplete | incomplete_expired | trialing | active |
     *  past_due | canceled | unpaid | paused */
    status: text("status").notNull(),
    priceId: text("price_id").notNull(),
    currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }).notNull(),
    /** past_due 猶予の起点（§6.4）。決済失敗は新周期内で起きるため End ではなく Start を使う */
    currentPeriodStart: integer("current_period_start", { mode: "timestamp" }).notNull(),
    cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" })
      .notNull()
      .default(false),
    /** この行に反映した Stripe イベントの created (unix秒)。順不同破棄の判定材料 */
    eventCreated: integer("event_created").notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("subscriptions_user_id_idx").on(t.userId),
    index("subscriptions_user_status_idx").on(t.userId, t.status),
  ],
);

export const usageCounters = sqliteTable(
  "usage_counters",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(), // "scan" | "chat"（将来拡張用に列を維持）
    period: text("period").notNull(), // "YYYY-MM"（JST暦月）
    count: integer("count").notNull().default(0),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    // 複合PKがそのまま UPSERT の conflict target になり、追加インデックス不要
    primaryKey({ columns: [t.userId, t.metric, t.period] }),
  ],
);

export const stripeWebhookEvents = sqliteTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(), // evt_xxx — PK が冪等キー
  type: text("type").notNull(),
  eventCreated: integer("event_created").notNull(),
  /** null = クレーム済みだが処理未完（クラッシュ検出用） */
  processedAt: integer("processed_at", { mode: "timestamp" }),
});
```

relations 追記: `stripeCustomersRelations` / `subscriptionsRelations` / `usageCountersRelations`（各 one(users)）と、既存 `usersRelations` への `stripeCustomer: one(stripeCustomers)` / `subscriptions: many(subscriptions)` / `usageCounters: many(usageCounters)`。型 export: `SubscriptionRow`。

### 6.2 スキーマ設計の決定

- **subscriptions は「sub_xxx = PK の 1 行を最新状態に上書き、履歴なし」**。「1ユーザー1行」方式は解約→再加入で sub_xxx が切り替わる瞬間の順不同（旧 deleted と新 created の前後）を正しく処理できない。結果として 1 ユーザー複数行（過去の canceled + 現行 active）は許容し、判定は「いずれかが有効なら plus」。履歴・監査の正は Stripe。
- **stripeWebhookEvents に payload 列は持たない**。イベント本文は Stripe 側で 30 日再取得・リプレイ可能。行サイズ肥大と PII 保持リスクに見合わない。
- **usage_counters の metric は "scan" と "chat"**（チャットの実ゲートは月次プール §7.3）。metric 列は将来の拡張（追加回数券等）にも使う。

### 6.3 webhook の冪等・順不同防御（DB 層）

libSQL(HTTP) のインタラクティブトランザクションは制約が厳しいため**不使用**。単文の原子性＋設計で担保し、全ステップを単独冪等にする（途中クラッシュしても再送で収束）。

```ts
// 1) 冪等クレーム（eventId PK への INSERT が原子的なテストアンドセット）
const claimed = await db
  .insert(stripeWebhookEvents)
  .values({ eventId: event.id, type: event.type, eventCreated: event.created })
  .onConflictDoNothing();
if (claimed.rowsAffected === 0) {
  const prev = await db.query.stripeWebhookEvents.findFirst({
    where: eq(stripeWebhookEvents.eventId, event.id),
  });
  if (prev?.processedAt) return json({ received: true }); // 完全重複 → 即200
  // processedAt null = 前回クラッシュ → 再処理に進む
}

// 2) fetch-fresh した subscription 現在値を LWW 付き UPSERT
try {
  await db.insert(subscriptions).values({ /* 現在値 */ eventCreated })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: { /* 現在値 */ eventCreated, updatedAt: new Date() },
      // 古いイベントの後着は自動破棄（>= は同秒後着の許容）
      setWhere: sql`excluded.event_created >= ${subscriptions.eventCreated}`,
    });
  // 3) 確定
  await db.update(stripeWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(stripeWebhookEvents.eventId, event.id));
} catch (e) {
  // クレーム解放して 500 → Stripe の自動再送に委ねる。
  // processed_at IS NULL 条件が必須: 同一 eventId の並行受信で、先行処理が
  // 完了させた行（processedAt 済み）を後発の失敗が消してしまうのを防ぐ
  await db.delete(stripeWebhookEvents).where(and(
    eq(stripeWebhookEvents.eventId, event.id),
    isNull(stripeWebhookEvents.processedAt),
  ));
  throw e;
}
```

- fetch-fresh（`subscriptions.retrieve()` の現在値）で upsert する場合、`eventCreated` には**取得時刻 (unix 秒)** を入れる — 取り直した現在値は定義上どのイベントよりも新しい。
- `db.batch()` はステップ間の条件分岐が挟めないため不採用。

### 6.4 状態機械と entitlement 判定

Stripe status の遷移（アプリは遷移を起こさず観測のみ）:

```
(Checkout) → incomplete ──決済成功──→ active ⇄ past_due ──リトライ失敗──→ canceled | unpaid
                │                                  （Smart Retries 設定で cancel に集約）
                └─ 23h 放置 → incomplete_expired
active + cancel_at_period_end=true ──期間末── canceled（customer.subscription.deleted）
trialing ── trial 終了 ── active / paused        ※当面トライアル未使用
```

| Stripe status | entitlement | 備考 |
|---------------|-------------|------|
| `active` / `trialing` | **plus** | `cancelAtPeriodEnd=true` でも期間末までは status=active のまま → 自然に期間末まで有効 |
| `past_due` | **plus（猶予）** | 猶予は Stripe Smart Retries + 「最終リトライ失敗時に subscription を cancel する」ダッシュボード設定で自動的に有限（目安 1〜2 週間）。独自タイマー不要。バックストップは **currentPeriodStart + 7 日**で強制失効（Stripe は決済失敗でも周期を進めるため、期間末基準では猶予が約 37 日に伸びてしまう） |
| `canceled` / `unpaid` / `incomplete` / `incomplete_expired` / `paused` | free | `incomplete` は初回決済未完了（23h 窓）。plus にしない |

```ts
const CLOCK_SKEW_MS = 5 * 60_000;            // 時計ずれ許容
const RENEWAL_GRACE_MS = 48 * 3600_000;      // 更新 webhook 遅延の猶予（日次 reconcile が 1 回失敗しても失効しない余裕）
const PAST_DUE_GRACE_MS = 7 * 24 * 3600_000; // dunning 猶予のバックストップ

function isEntitled(sub: SubscriptionRow, now = Date.now()): boolean {
  switch (sub.status) {
    case "active":
    case "trialing":
      return now < sub.currentPeriodEnd.getTime() + RENEWAL_GRACE_MS + CLOCK_SKEW_MS;
    case "past_due":
      // currentPeriodEnd は失敗した請求の「翌期末」を指すため使わない。
      // 猶予の起点は currentPeriodStart（= 失敗した請求の周期開始）
      return now < sub.currentPeriodStart.getTime() + PAST_DUE_GRACE_MS;
    default:
      return false;
  }
}

async function getEntitlement(userId: string): Promise<"free" | "plus"> {
  const subs = await db.select().from(subscriptions)
    .where(eq(subscriptions.userId, userId)); // user_id_idx、高々数行
  return subs.some((s) => isEntitled(s)) ? "plus" : "free";
}
```

- `currentPeriodEnd` 超過を即失効にしない（更新成功 webhook が数時間遅れても切れない）。canceled への遷移は webhook 到達で即時反映。
- **entitlement は毎回 DB を読む**。Better Auth の cookieCache（5 分）に載せない（解約・失効の反映が 5 分遅れるため）。Turso hnd1 + 関数 region hnd1 で低レイテンシ。

### 6.5 マイグレーション計画

- 追加専用マイグレーション 1 本: schema.ts 追記 → `npm run db:generate`（`CREATE TABLE` ×4 + INDEX のみであることを目視確認）→ ローカル `npm run db:migrate` → 本番 `npm run db:migrate:prod`。
- デプロイ順: **migrate → コードデプロイ → `BILLING_MODE=meter`（計測）→ `BILLING_MODE=enforce`**。各段階で常に整合。
- ロールバック: 第一手段は **`BILLING_MODE=off`**（ゲートと課金アクションが無効化され、ユーザー向け挙動は現状に戻る）。物理削除は手動 SQL（DROP TABLE ×4 + `__drizzle_migrations` 行削除）。
- **運用注記**: 実課金開始後の `off` は「ゲート解放」を意味するだけで**課金停止ではない**。既存契約は Stripe 側で生き続けるため、webhook / reconcile / 全データ削除時の解約連動（§6.6）はモードに関係なく常時稼働させる。

### 6.6 全データ削除（`deleteAllUserDataAction`）との整合

**Stripe 解約成功をローカル削除の先行条件にする**。DB を先に消すとマッピングが失われ「課金は継続するが誰のものか分からない」孤児サブスクが生まれる。

```ts
// records.ts: rl チェック直後、db.delete(records) の前に挿入。
// BILLING_MODE では分岐しない — off へのロールバック中でも既存契約は生きている（§6.5 運用注記）。
// subscriptions テーブルの行有無だけで判断する（行ゼロなら実質 no-op = 現状動作）
{
  const activeSubs = /* canceled / incomplete_expired 以外の行 */;
  for (const s of activeSubs) {
    await stripe.subscriptions.cancel(s.stripeSubscriptionId);
    // 失敗したら throw → データ削除自体を中断（「課金だけ残って記録は消えた」を絶対に作らない）
  }
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
  await db.delete(stripeCustomers).where(eq(stripeCustomers.userId, userId));
}
```

- cancel は **即時解約・日割り返金なし**（全データ削除 = 離脱意思。D-18 / §15 確定。規約に明記）。
- cancel 後に後着する `customer.subscription.deleted` webhook は「customer 不明なら no-op + warn」で吸収。
- **usage_counters は消さない**（消すと「全削除→同月内の無料枠リセット」の抜け道になる。メータリングデータでありユーザーコンテンツではない。アカウント自体の削除時は FK cascade で自然に消える）。
- 将来 Better Auth の user 行削除を実装する際も、cascade 前に同じ「cancel 先行」フックが必要。

---

## 7. 認可・機能ゲート

**すべてサーバー側（Server Actions 内）で強制する。クライアント表示は補助にすぎない。**

### 7.0 動作モード `BILLING_MODE`

2 値フラグでは「計測だけ先行する Phase 0」が表現できないため 3 値にする。

| 値 | ゲート | usage 記録 | 課金アクション | 用途 |
|----|--------|-----------|---------------|------|
| `off`（既定） | 素通し | しない | `BILLING_DISABLED` | 現状動作・ロールバック |
| `meter` | 素通し | **する** | `BILLING_DISABLED` | Phase 0 計測。`enforce` 切替時に当月カウントが連続する（切替月の枠リセット漏れを防ぐ） |
| `enforce` | 強制 | する | 有効 | 本稼働 |

webhook / reconcile / 全データ削除時の解約連動はモードに関係なく常時稼働（§6.5 運用注記）。

### 7.1 二層構造

| 層 | 実装 | 時間軸 | 目的 | 対象 |
|----|------|--------|------|------|
| 乱用防止 | 既存 `rate-limit.ts`（プロセス内メモリ・現状維持） | 60 秒窓 | 連打・スパム・DB/AI 保護 | 全プラン共通 |
| 課金ゲート | `usage_counters`（Turso・永続） | JST 暦月 | プラン別上限 | `BILLING_MODE=enforce` 時のみ強制（`meter` は記録のみ） |

実行順: `requireUserId` → `limitXxx`（メモリ・コストゼロ）→ `consumeUsage`（DB 書き込み）。rate-limit が前段にあることで usage の UPSERT 自体が連打から守られる。統合はしない（窓の粒度が違い、乱用防止まで DB 依存にするのは本末転倒）。「課金ゲート」列の適用条件は §7.0 の表に従う（`meter` は記録のみ）。

### 7.2 使用量カウンタ: increment-first の atomic UPSERT（新設 `src/lib/usage.ts`）

check-then-increment は同時リクエストで上限をすり抜ける。**先に原子的に加算し、返った新値で判定**する。SQLite は UPSERT を直列化するため各リクエストが一意な新 count を受け取り、超過分は全員拒否 — すり抜けゼロ。

```ts
export function jstPeriod(now = Date.now()): string {
  return new Date(now + 9 * 3600_000).toISOString().slice(0, 7); // "2026-07"
}

const LIMITS = {
  free: { scan: 15, chat: 45 },
  plus: { scan: 300, chat: 900 }, // フェアユース上限
} as const;

export async function consumeUsage(userId: string, metric: "scan" | "chat"):
  Promise<{ ok: true } | { ok: false; error: string; code: string }> {
  const mode = process.env.BILLING_MODE ?? "off";
  if (mode === "off") return { ok: true }; // 現状動作

  const [row] = await db.insert(usageCounters)   // meter / enforce とも必ず記録
    .values({ userId, metric, period: jstPeriod(), count: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.metric, usageCounters.period],
      set: { count: sql`${usageCounters.count} + 1`, updatedAt: new Date() },
    })
    .returning({ count: usageCounters.count });

  if (mode === "enforce") {
    const limit = LIMITS[await getEntitlement(userId)][metric];
    if (row.count > limit) {
      return { ok: false, error: "今月の利用回数の上限に達しました", code: "LIMIT_REACHED" };
    }
  }
  return { ok: true };
}

/** Gemini 失敗時の返金。負値は MAX(0, …) で防止 */
export async function refundUsage(userId: string, metric: "scan" | "chat") {
  /* count = MAX(0, count - 1) WHERE userId AND metric AND period = jstPeriod() */
}
```

- 拒否時にデクリメントしない（count が limit を超えて伸びるだけで判定に無害。残量表示は `min(count, limit)` で丸める）。
- **消費ポリシー**: Gemini エラー / `failed` は**返金**(価値が渡っていない)。`partial` は**消費**（AI コスト発生・結果も返している）。月跨ぎ直後の返金が新月に当たるエッジは MAX(0,…) で許容。

### 7.3 チャット: 月次プール（実ゲート）+ 記録単位判定（Free の UX）の二層

`chatAboutRecordAction` には **recordId が null / "pending" の未保存経路**があり、そこでは会話履歴・title・ocrRaw を**クライアントが自由に申告できる**（records.ts L310-345）。クライアント申告の履歴長をゲートに使うと、毎回空履歴を送るだけで無制限になり「認証済み汎用 LLM プロキシ」と化す。また記録単位の上限だけでは、ゲートのない `saveRecordAction` で同内容を新規保存し直すたびに枠が回復してしまう。よって**実ゲートは月次プール**とする。

| 層 | 対象 | 実装 | 上限 |
|----|------|------|------|
| 月次プール（実ゲート） | **全チャット呼び出し**（未保存・保存済みの両経路） | `usage_counters` metric `"chat"` を §7.2 の `consumeUsage` で消費。Gemini 失敗時は返金 | Free 45 往復/月（15 記録 × 3 往復相当）/ plus 900 往復/月（フェアユース） |
| 記録単位（Free の UX） | 保存済み記録（persistId 経路）のみ | **DB から読んだ** `chatMessages` の user ロール件数で判定。クライアント申告の履歴は判定に一切使わない | Free 3 往復/記録。plus は記録単位の上限なし |

```ts
// 1) 月次プール（全経路・これが防壁）
const pool = await consumeUsage(userId, "chat");
if (!pool.ok) return { ok: false, error: pool.error, code: "CHAT_LIMIT_REACHED" };

// 2) 記録単位（persistId 経路のみ・Free のみ）
if (persistId && (await getEntitlement(userId)) === "free") {
  const userTurns = dbRecord.chatMessages.filter((m) => m.role === "user").length;
  if (userTurns >= 3) {
    await refundUsage(userId, "chat"); // プール消費を戻す
    return { ok: false, error: "この記録の質問回数の上限に達しました", code: "CHAT_RECORD_LIMIT_REACHED" };
  }
}
```

- **前提条件**: 記録単位判定は、履歴 truncation（保存・追記・正規化の三箇所にある `slice(-40)` = 最大 20 往復）より上限が十分小さい場合のみ成立する。Free 3 往復（6 メッセージ ≤ 40）は成立。**plus に記録単位上限を置かないのはこのため**（30 往復/記録は 40 メッセージ制限下で永遠に到達せず死文になる。plus の防壁は月次プール 900）。
- 解約後は同じ判定が Free 上限で効く（履歴閲覧は無制限のまま）。

### 7.4 enforcement 挿入点（`src/actions/records.ts`、現行行番号）

| アクション | 挿入位置 | 内容 |
|-----------|----------|------|
| `createScanAction` | L136（入力検証直後）と L138（`storePhoto`）の間 | `consumeUsage(userId, "scan")` → NG なら即 return。Blob 保存・Gemini 呼び出しの手前で止める |
| 同上（返金） | return 直前に**新設**する分岐 `if (scan.status === "failed") await refundUsage(userId, "scan")` + catch ブロック（L214-220）内 | **現行コードに failed 分岐は存在しない**（failed も ok:true のまま L204 の return に合流する）ため、分岐の新設が必須。通常失敗と throw の両方で返金 |
| 同上（`forceStatus`） | L118-119 / L145-146 | デモ用パラメータ。本番（`VERCEL_ENV=production`）では無視する（放置すると「消費→即返金 + Blob 保存」だけが残る悪用経路になる） |
| `chatAboutRecordAction` | L363（persistId 経路の所有権チェック通過後）と L365（AI 呼び出し）の間 | §7.3 の二層判定。「実際に AI を呼ぶ」直前でのみ消費。catch（L413-419）で `refundUsage(userId, "chat")` |
| `saveRecordAction` | 挿入なし | 保存件数はゲートしない（§4）。将来必要になれば `SELECT count(*)`（records_user_id_idx）方式 |
| `deleteAllUserDataAction` | L544 の後、L546 の前 | §6.6 の Stripe 解約先行 |

---

## 8. API / Server Actions 契約

### 8.1 新設 Server Actions（`src/actions/billing.ts`）

既存の ActionResult パターン・`requireUserId()` を踏襲。

```ts
"use server";

export type BillingPlan = "plus_monthly"; // 将来 | "plus_yearly"

export type BillingErrorCode =
  | "UNAUTHORIZED" | "BILLING_DISABLED" | "ALREADY_SUBSCRIBED"
  | "NO_CUSTOMER" | "STRIPE_ERROR";

// 1) Checkout 開始。返った url へクライアントが同一タブ遷移
export async function createCheckoutSessionAction(
  input: { plan: BillingPlan },              // Price ID は絶対に受け取らない
): Promise<ActionResult<{ url: string }>>;

// 2) Portal 導線。引数なし（customer はセッションの userId から解決）
export async function createPortalSessionAction(): Promise<ActionResult<{ url: string }>>;

// 3) 現在の契約状態（設定画面・success 直後の表示で使用）
export type SubscriptionStatusView = {
  entitlement: "free" | "plus";
  stripeStatus: "trialing" | "active" | "past_due" | "canceled" | "unpaid"
    | "incomplete" | "incomplete_expired" | "paused" | null;
  plan: BillingPlan | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;           // ISO 8601
  /** Free のときのみ: 今月のスキャン残数と回復日 */
  scanRemaining: number | null;
  resetsAt: string | null;
};
export async function getSubscriptionStatusAction(): Promise<
  ActionResult<SubscriptionStatusView>
>;
```

**エラーコードの表示規約**: 既存アクションの `error` は表示用の日本語文字列であり、クライアントはそのまま画面に出す。ゲート系の新コード（`LIMIT_REACHED` / `CHAT_LIMIT_REACHED` / `CHAT_RECORD_LIMIT_REACHED` / `BillingErrorCode`）は**機械判別用**で、そのまま表示してはならない。ゲートの返却形は `{ ok: false, error: 表示用日本語, code: 機械コード }` とし、ペイウォール分岐・UI 出し分けは `code` で行う。

```ts

// 4) success 戻り時の即時同期（§5.5）。client_reference_id 検証込み
export async function syncCheckoutSessionAction(
  input: { sessionId: string },
): Promise<ActionResult<{ entitlement: "free" | "plus" }>>;
```

### 8.2 Route Handlers（2 本のみ）

| パス | メソッド | 認証 | 役割 |
|------|---------|------|------|
| `/api/stripe/webhook` | POST | Stripe 署名検証のみ | §5.6 |
| `/api/stripe/reconcile` | GET | `Authorization: Bearer ${CRON_SECRET}` | 日次 reconcile（vercel.json の crons に追加） |

### 8.3 モジュール分割

| モジュール | 責務 |
|-----------|------|
| `src/lib/stripe/client.ts` | Stripe SDK singleton + apiVersion 固定 |
| `src/lib/stripe/customer.ts` | `getOrCreateCustomer`（§5.3） |
| `src/lib/stripe/sync.ts` | `syncStripeSubscription`（§5.5 / §6.3） |
| `src/lib/billing/entitlement.ts` | `getEntitlement` / `isEntitled`（§6.4） |
| `src/lib/usage.ts` | `consumeUsage` / `refundUsage` / `jstPeriod`（§7.2） |
| `scripts/stripe-setup.mjs` | Product/Price 冪等 seed（§5.2） |

- 既存アクションへの変更は §7.4 の挿入のみ。動作モードごとの挙動は §7.0 の表に従う（`off` / `meter` では課金アクションは `BILLING_DISABLED`）。**webhook・reconcile・全データ削除時の解約連動はモードに関係なく常時稼働**（`off` 期間のイベント・契約を取りこぼさない）。

---

## 9. UI フロー

トーン原則: 責めない・大きい文字（見出し 20px・本文 16px+・ボタン高さ 52px+）・選択肢は 2 つまで・赤色を使わない。

### 9.1 設定画面「プラン」セクション（S-07 拡張、`settings-app.tsx`）

配置: 表示設定グループの直後。`GroupTitle`「プラン」。

| 状態 | 表示 | 導線 |
|------|------|------|
| Free | 「現在のプラン: 無料プラン」＋「今月のスキャン: あと◯回（◯月1日にリセット）」＋「撮るほどプラス（月額480円・税込）にすると、回数を気にせず使えます。」 | 主ボタン「プラスについて見る」→ 申込確認画面 |
| plus（有効） | 「現在のプラン: 撮るほどプラス」＋「次回の更新日: ◯年◯月◯日（月額480円・税込）」 | リンク「お支払いの確認・変更・解約」→ Portal |
| plus（解約予約） | 「撮るほどプラス（◯月◯日まで）」＋「◯月◯日以降は自動的に無料プランになります。それまでは今までどおり使えます」 | リンク「プラスを続ける（解約を取り消す）」→ Portal |
| past_due | 「お支払いが確認できていません」バナー | ボタン「お支払い方法を確認する」→ Portal |

下部に小リンク:「特定商取引法に基づく表記」「利用規約」。

### 9.2 ペイウォール（月間スキャン上限到達時）

ボトムシート型モーダル。バツ印だけに頼らず下側ボタンでも閉じられること。文言（実文）:

> 「**今月の無料分（15回）を使い切りました**
>
> たくさんスキャンしていただき、ありがとうございます。
> **◯月1日になると、また15回**スキャンできます。
> これまでの記録は、履歴と地図からいつでも見られます。
>
> すぐに続けたい方には、回数を気にせず使える
> 撮るほどプラス（月額480円・税込）があります。」
>
> ［ **プラスについて見る** ］（主ボタン・塗り）
> ［ **来月まで待つ** ］（副ボタン・枠線）

設計意図: ①最初の一文は事実のみ（「制限中」等の警告語を避ける）②無料で回復することを課金訴求より**先に**書く ③主ボタンは「申し込む」ではなく「見る」— 誤タップ即課金の不安を除く。

### 9.3 アップグレードフロー

```
ペイウォール or 設定
  → 申込確認画面（アプリ内・特商法 12条の6 の 6 項目を 1 画面に集約 §11.2）
  → Stripe Checkout（hosted・locale=ja・同一タブ遷移）
  → success: /settings?checkout=success&session_id=… → syncCheckoutSessionAction で即時反映
     cancel:  /settings?checkout=cancel
```

- 反映待ち（数秒）の文言:「お手続きを確認しています。そのままお待ちください（10秒ほどかかることがあります）」
- 確定後:「**撮るほどプラスのお手続きが完了しました。**今日から回数を気にせずスキャンできます。領収書はメールでお送りしています。」
- cancel 戻り（責めない）:「お手続きを途中でやめました。**料金はかかっていません。**無料プランのまま、これまでどおり使えます。」

### 9.4 解約フロー / Customer Portal

Portal Configuration:

| 項目 | 設定 | 理由 |
|------|------|------|
| `invoice_history` | on | 領収書問い合わせ削減 |
| `payment_method_update` | on | カード期限切れ対応 |
| `subscription_cancel` | on・`mode: "at_period_end"`・cancellation_reason 収集 on | 即時解約は返金対応が発生するため不可 |
| `subscription_update` | 当面 off | プラン 1 つのため。年額追加時に on（月⇄年切替） |
| `customer_update` | off（少なくとも email 不可） | Better Auth の email と乖離させない |
| `business_profile` | 特商法ページ・プライバシーポリシー URL | 特商法表記への到達性 |

- 導線: 設定 → プラン → 「お支払いの確認・変更・解約」。**解約導線を申込導線より深くしない**（改正特商法の趣旨。引き止め画面は挟まない）。
- Portal へ飛ぶ前の中間案内（1 画面・引き止めではなく案内）:
  「解約は**いつでも**できます。解約しても、**◯月◯日（期間の終わり）までは**プラスのまま使えます。日割りの返金はありません。この先は Stripe社の管理画面が開きます。」［お支払い・解約の画面を開く］／［もどる］
- 解約後も「解約しても、これまでの記録は消えません」を明示。

### 9.5 残量表示「今月あと◯回」

| 場所 | 表示 | 備考 |
|------|------|------|
| ホーム（スキャン CTA 直下） | 「今月あと 7回 スキャンできます」14〜15px・静かに常時 | Free のみ。残 0 で「今月の無料分を使い切りました（◯月1日に回復）」に置換、CTA 押下でペイウォール |
| スキャン完了画面の末尾 | 「（今月あと 6回）」小さく 1 行 | 成功体験直後に警告色を使わない。残 2 回以下のときだけ「あと2回です。◯月1日にまた15回になります」を追加 |
| 結果画面のチャット欄 | 「この記録であと◯回質問できます」 | Free のみ。0 で入力欄を無効化し 1 行案内 + プラス導線。月次プール（§7.3）到達時は「今月の質問の無料分を使い切りました（◯月1日に回復します）」に置換 |
| plus 時 | 残量表示なし | カウントを見せないことが価値の体感 |

原則: 残量は「減っていく脅し」ではなく「あと使える回数 + 回復日」のセットで提示。

### 9.6 支払い失敗（past_due）

アプリ内バナー:「お支払いが確認できませんでした。カードの有効期限などをご確認ください。数日間はこれまでどおりお使いいただけます。［お支払い方法を確認する］」。リトライ猶予中は機能を止めない。最終失敗で Free 降格後:「無料プランに切り替わりました。記録は消えていません」。**降格月の注意**: プラス時代の消費が月次カウンタに残るため、無料分をすでに超えていればスキャン残は 0 になる。その場合は「今月のスキャンは◯月1日からまた使えます」を併記する（カウンタの補正・日割りはしない。解約直前の駆け込み消費の悪用を防ぐ。D-23）。

---

## 10. セキュリティ

| 項目 | 設計 |
|------|------|
| webhook 署名検証 | `constructEvent`（tolerance 既定 300 秒）。失敗は 400、raw body をログに残さない |
| middleware | 現行 matcher は `/api` を含まず webhook 経路に干渉しない（確認済み）。matcher を広げる際は `/api/stripe` を除外 |
| シークレット | すべて Vercel env。**`NEXT_PUBLIC_` の Stripe 変数はゼロ**（hosted 型で publishable key すら不要） |
| IDOR 防止 | customerId / subscriptionId / priceId をクライアントから一切受け取らない。入力は `plan` enum のみ → サーバー側 env マップで解決。Portal / status もセッション userId → DB マッピング経由でのみ解決 |
| Checkout 乗っ取り防止 | success URL 到達だけでは何も付与しない。`syncCheckoutSessionAction` は `session.client_reference_id === 現在の userId` を検証し、不一致は無視。付与の根拠は常に Stripe API からの取得データ |
| リプレイ | eventId PK クレームで重複処理を排除。ただし並行受信のエッジでは冪等な sync が無害化の本体であり、PK は最適化と捉える（クレーム解放の delete には `processed_at IS NULL` 条件必須 §6.3） |
| 動作モード | `BILLING_MODE`（off / meter / enforce §7.0）。`off` で現状動作。webhook / reconcile / 削除時の解約連動はモード非依存で常時稼働 |
| デモ用 `forceStatus` | 本番では無視（§7.4）。「消費→返金 + Blob 書き込み」の悪用経路を残さない |
| cron | `/api/stripe/reconcile` は `CRON_SECRET` の Bearer 検査 |
| webhook 内の処理 | retrieve + upsert のみに絞り数秒で返す（遅延応答は Stripe が失敗扱い→再送嵐） |

---

## 11. 日本向け法務・運用

### 11.1 特定商取引法に基づく表記（新規ルート `/legal/tokushoho`）

記載項目: 事業者氏名（個人名。屋号のみは不可）/ 住所 / 電話番号 / メール / 販売価格「月額480円（税込）」/ 対価以外の費用（通信費）/ 支払時期・方法 / 役務提供時期（決済完了後ただちに）/ 解約条件（いつでも・期間末まで利用可・日割り返金なし）/ 返金方針 / 動作環境 / プラン内容と制限。

- **住所・電話は全記載を原則とする（D-29）**。省略方式（「請求があれば開示」）は解釈に幅があり、初回リリースのデフォルトにはしない。公開に支障がある場合のみ、弁護士確認のうえで省略を例外検討する。
- ページ雛形（プレースホルダ入りの表形式）は ux-legal-jp 成果物どおり。実値（氏名・住所・電話・メール）はリリース前に記入する。

### 11.2 改正特商法（12条の6・最終確認画面）への適合

Stripe Checkout 単独では「役務提供時期」「解約に関する事項」の表示が不足しうる。**安全側の設計**:

1. **Checkout 直前にアプリ内「申込内容の確認」画面**を置き、法定 6 項目を 1 画面に集約:

> 「**お申し込み内容のご確認**
> ・プラン: 撮るほどプラス（スキャン回数たっぷり）
> ・料金: **月額480円（税込）**。1か月ごとに自動更新され、毎月の更新日にクレジットカードへ請求されます。
> ・利用開始: お支払い手続きの完了後、すぐに使えます。
> ・解約: いつでもできます。「設定 → プラン」から手続きすると、期間の終わりで更新が止まります。途中解約の日割り返金はありません。
> ［利用規約］・［特定商取引法に基づく表記］」
> ［ お支払いに進む（Stripe の画面が開きます） ］／［ もどる ］

2. Product 名に分量・周期を含め（§5.2）、Checkout の `custom_text.submit.message` と `consent_collection.terms_of_service: required` で hosted 画面内にも解約情報・規約同意を残す。
3. 解約は申込と同程度の手数で到達可能にし、引き止め画面を挟まない。
4. 充足性の最終整理は**要専門家確認**（事前確認画面方式なら実務リスクは大きく下がる）。

### 11.3 価格表示・税

- 全箇所（アプリ内・ペイウォール・特商法表記）で「**月額480円（税込）**」に統一（総額表示義務）。
- Stripe price は `tax_behavior: "inclusive"`（内税）。表示額 = 請求額 = アプリ表示額を一致させる。端数の出ない内税一本価格を維持。
- 免税事業者のうちは Stripe Tax 不要。課税事業者化時に再検討。

### 11.4 領収書・インボイス

- Stripe の receipt メール（日本語）+ Portal の請求履歴 PDF で実務上十分。設定に「領収書はお支払い完了メール、または『お支払いの確認』画面から取得できます」と 1 行案内。
- 消費者向けサブスクでは適格請求書（インボイス）は通常不要。免税事業者なら発行不可・登録義務もない。課税売上 1,000 万円超で**要税理士確認**。

### 11.5 利用規約・プライバシーポリシー追記

1. プランと料金（税込・自動更新・更新日課金）
2. **無料トライアルは当面なし**（「知らないうちに課金された」事故の最大要因。導入時は無料期間後の課金開始明示を全確認画面に必須化）
3. 料金改定: 定型約款の変更手続（民法548条の4）に沿い事前周知 + 次回更新分から適用
4. 返金: 「性質上、提供開始後の返金は原則不可。通信販売のためクーリングオフ適用なし。ただし (a) 誤請求・二重請求 (b) 長時間の重大障害 (c) 法令上必要な場合は個別返金」— 法定例外を潰さない書き方（**要専門家確認**)
5. 支払い失敗時の扱い（リトライ→Free 降格・データは消さない）
6. プライバシーポリシー: カード情報は Stripe が取り扱い自サーバーに保存しない旨、決済目的の Stripe への情報提供、Stripe ポリシーへのリンク

### 11.6 運用

| 項目 | 方針 |
|------|------|
| 支払い失敗・督促 | Stripe Smart Retries + Stripe の失敗通知メールで基本充足。補完はアプリ内バナー（§9.6） |
| 問い合わせ | 特商法表記のメールに一本化。目安 2 営業日以内返信（運用目標）。FAQ（解約・領収書・機種変更）を設定内リンクで先回り |
| 価格改定 | 適用の 30 日以上前（推奨 60 日前）にメール + アプリ内バナー。適用は各ユーザーの次回更新日から。既存据え置きも選択肢 |
| 解約者対応 | `cancel_at_period_end` で期間末まで自動担保。ウィンバックの引き止めメールは送らない（ブランドトーンと解約妨害リスク） |

---

## 12. 環境変数一覧

| 変数 | Development | Preview | Production | 備考 |
|------|-------------|---------|------------|------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_test_...` | `sk_live_...` | server-only |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` が出力する `whsec_...` | テスト endpoint の whsec | 本番 endpoint の whsec | listen 用と endpoint 用は別物 |
| `STRIPE_PRICE_ID_PLUS_MONTHLY` | test の `price_...` | 同左 | live の `price_...` | seed スクリプト出力 |
| `STRIPE_PRICE_ID_PLUS_YEARLY` | （年額導入時） | 同左 | 同左 | 将来 |
| `BILLING_MODE` | `enforce` | `enforce` | `off` → Phase 0 で `meter` → Phase 3 で `enforce` | 3 値モード。§7.0 |
| `CRON_SECRET` | 任意 | 任意 | 強乱数 | reconcile 認証 |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | preview URL | 本番ドメイン | success/cancel/return_url 用（既存があれば流用） |

`.env.example` への追記と、`NEXT_PUBLIC_` の Stripe 変数を作らないことをレビュー観点に含める。

---

## 13. 段階的導入計画と PR Plan

### Phase

| Phase | 内容 | 完了条件 |
|-------|------|----------|
| **0. 計測** | PR-1 を本番投入し `BILLING_MODE=meter`（記録するが拒否しない・課金なし） | p50/p90 の月間スキャン・チャット数が取れ、無料枠 15 回・チャットプール 45 の妥当性を検証できる |
| **1. 基盤** | 課金スキーマ + Stripe 基盤 + webhook を `BILLING_MODE=meter` のまま本番デプロイ。テストモードで E2E | §16 の E2E ①〜⑥ がテストモードで green |
| **2. UI + ゲート** | ペイウォール・設定・法務ページ・ゲート有効化コード（`meter` のまま） | `off` で現状と完全同一動作・`meter` は DB 書込のみ追加（回帰テスト） |
| **3. 本番有効化** | live キー・実カード 1 周・ダッシュボード手動設定（§5.7）→ `BILLING_MODE=enforce` | 初回課金ユーザーの一連フロー（購読→利用→解約）が本番で確認済み |

### PR Plan（独立マージ可能な単位）

| PR | 内容 | 依存 | 目安 |
|----|------|------|------|
| PR-1 | `usage_counters` テーブル + `consumeUsage` / `refundUsage`（`BILLING_MODE` 3 値対応）+ マイグレーション | — | S |
| PR-2 | 課金スキーマ（`stripe_customers` / `subscriptions` / `stripe_webhook_events`）+ `entitlement.ts` + マイグレーション | — | S |
| PR-3 | Stripe 基盤: `lib/stripe/*`（client / customer / sync）+ `/api/stripe/webhook` + seed スクリプト + env 整備 | PR-2 | M |
| PR-4 | `billing.ts` Server Actions（checkout / portal / status / syncCheckout）+ `/api/stripe/reconcile` + cron 設定 | PR-3 | M |
| PR-5 | ゲート有効化: `createScanAction` への consume/refund（failed 分岐の新設）、チャット二層判定、`forceStatus` の本番無視、`deleteAllUserDataAction` の cancel 先行 | PR-1, PR-2 | M |
| PR-6 | UI: 設定「プラン」セクション + 申込確認画面 + success/cancel ハンドリング + ペイウォール + 残量表示 | PR-4 | L |
| PR-7 | 法務: `/legal/tokushoho` + 利用規約/プライバシーポリシー改定 + Checkout custom_text 確認 | PR-4 | S |
| PR-8 | E2E 検証スクリプト・本番切替 runbook・README 追記 | PR-1〜7 | S |

各 PR は `BILLING_MODE=off`（または `meter`）の限りユーザー向け挙動への影響ゼロでマージ可能。PR-1 と PR-2 は並列着手可。

---

## 14. Key Decisions

| # | 決定 | 理由 |
|---|------|------|
| D-01 | サブスク主軸・2 プラン制（Free / 撮るほどプラス）。**初期価格は月額 480 円（税込）のみ**。年額 4,800 円は第 2 弾 | 継続原価と収益の整合。従量・買い切りは KPI と原価構造に非整合（§4）。年額は実装・説明コストを後回し（D-30） |
| D-02 | 表示名「撮るほどプラス」、内部識別子は `plus` に全系統統一 | 中高年に説明しやすい名称。表示と内部名の対応を 1:1 に保ち混乱を防ぐ |
| D-03 | 保存・履歴・地図・表示モードは全プラン無制限 | 「思い出は人質に取らない」。保存ゲートは保存率 KPI を自傷する |
| D-04 | hosted Checkout + hosted Portal。Payment Element 不採用 | PCI SAQ A・実装最小・JP 決済要件の丸投げ（§5.1） |
| D-05 | 反映経路は `syncStripeSubscription` 1 本に集約。webhook を正、success 戻りも同一関数で即時反映、日次 reconcile が保険 | 「払ったのに Free」を排除しつつ、冪等な単一経路で整合性を保つ（§5.5） |
| D-06 | イベント payload を状態として信用せず fetch-fresh で再取得して upsert | 到着順序問題を原理的に消す（§5.5） |
| D-07 | subscriptions は sub_xxx PK の 1 行最新・履歴なし | 再加入時の順不同に強い。履歴の正は Stripe（§6.2） |
| D-08 | 冪等性: eventId PK クレーム + `event.created` LWW（setWhere）。インタラクティブ txn 不使用 | libSQL 制約下で単文原子性のみで重複・順不同・クラッシュを吸収（§6.3） |
| D-09 | entitlement は `active` / `trialing` / `past_due` を有効。past_due の猶予は Smart Retries 設定で有限化 + 期間末+7日のバックストップ | 決済失敗で即断ち切らない。独自督促タイマーを持たない（§6.4） |
| D-10 | 使用量は increment-first の atomic UPSERT + RETURNING。失敗スキャンは返金、partial は消費 | check-then-increment の race によるすり抜けをゼロに（§7.2） |
| D-11 | チャットは月次プール（実ゲート・全経路）+ Free のみ記録単位 3 往復（DB 判定・UX）の二層 | 未保存チャット経路はクライアントが履歴を申告でき、記録単位だけでは saveRecord 複製で枠が回復する。プールが防壁（§7.3。design-critic B-1/M-1/M-2 反映） |
| D-12 | 既存 rate-limit（乱用防止）と usage（課金ゲート）の二層を分離維持 | 役割が直交。統合すると乱用防止まで DB 依存化（§7.1） |
| D-13 | 動作モード `BILLING_MODE = off / meter / enforce` の 3 値。webhook・reconcile・削除時解約連動はモード非依存 | 2 値では Phase 0 計測が表現できず、enforce 切替月の当月カウントも欠落する。off は既存 MVP 保護とロールバック第一手段（§7.0 / §6.5。design-critic B-2/B-3 反映） |
| D-14 | Customer は初回 Checkout 時 lazy 作成。DB を調停者に重複防止、metadata.userId + client_reference_id で双方向紐付け | Free 大多数で Customer 量産を回避。ログイン経路を Stripe 障害から隔離（§5.3） |
| D-15 | Checkout 直前にアプリ内「申込内容の確認」画面（特商法 12条の6 の 6 項目集約） | Checkout 単独では提供時期・解約事項が不足しうる。安全側（§11.2） |
| D-16 | 無料トライアルなし | 「知らないうちに課金」事故の最大要因。無料プランが実質お試し（§11.5） |
| D-17 | 内税・総額表示で全箇所「月額480円（税込）」統一。`tax_behavior: inclusive` | 総額表示義務 + 表示額と請求額の一致が中高年の信頼に直結（§11.3） |
| D-18 | 全データ削除は Stripe 即時 cancel の成功を先行条件。`BILLING_MODE` に依存せず subscriptions の行有無で判断。usage_counters は残置 | 孤児サブスク・「課金だけ残る」事故と、削除による無料枠リセット悪用の両方を防止。off ロールバック中でも契約は生きている（§6.6） |
| D-19 | entitlement を cookie/セッションにキャッシュしない（毎回 DB 読み） | 解約・失効の反映遅延を排除。hnd1 同居で低レイテンシ（§6.4） |
| D-20 | 課金前に Phase 0（`BILLING_MODE=meter`）を先行 | 無料枠 15 回/月・チャットプール 45 をデータで補正してから課金を開く（§13） |
| D-21 | past_due 猶予の起点は `currentPeriodStart`（+7 日） | Stripe は決済失敗でも周期を進めるため、期間末基準では猶予が約 37 日に伸びる（§6.4。design-critic M-3 反映） |
| D-22 | Checkout Session に `expires_at` 30 分 + sync/reconcile で active 重複を検知し新しい方を自動 cancel | 放置セッションの後日完了による二重課金を防止・自己修復（§5.4 / §5.5。design-critic M-4 反映） |
| D-23 | 降格月の使用量カウンタは補正しない（残 0 になり得ることを文言で明示） | クランプ・リセットは駆け込み消費の悪用余地を生む。単純さと引き換えの UX は §9.6 の文言で吸収（design-critic M-5 反映） |
| D-24 | **チャットの Google Search grounding は既定 OFF**。スキャンのみ ON | 原価の支配項をスキャンに揃え粗利を安定化。チャットは OCR・既存解説・履歴で十分（§2） |
| D-25 | AI モデルは **`gemini-3.5-flash-lite`**（コード既定・`.env` 正） | 事業主確定。ドキュメント・フォールバックを 3.1 から統一 |
| D-26 | Free スキャン上限 **15 回/月** を初期確定値とする | KPI 行動が枠内。Phase 0 実測で数値のみ見直し可（§3） |
| D-27 | 初期決済手段は **カード + Apple Pay / Google Pay**（Checkout 既定）のみ | コンビニ・キャリアは第 2 弾以降。実装・サポートを単純化 |
| D-28 | 画質・圧縮によるプラン差別化、ギフト回数券・家族プラン、初期特別価格は **初期スコープ外** | 説明コストと「思い出を人質」リスクを避ける。必要なら第 2 フェーズ |
| D-29 | 特商法の住所・電話は **全記載が原則**（省略は弁護士確認後の例外のみ） | 解釈リスクを取らない安全側（§11.1） |
| D-30 | **初期リリースは月額のみ**（年額 Price は第 2 弾）。価格 **月額 480 円（税込）確定** | 選択肢を単純化。年額は seed 設計のみ先に用意可（§3 / §5.2） |
| D-31 | 全データ削除時の Stripe は **即時 cancel・日割り返金なし**（規約明記） | 孤児サブスク防止と離脱意思の一致（§6.6） |

---

## 15. 事業主確定事項（旧 Open Questions）

2026-07-26、事業主判断により **推奨ベストプラクティスを全件採用** して確定した。未決の事業判断は残っていない（運用上の数値微調整と専門家レビューは別枠）。

| # | 問い | **確定内容** | 対応 Key Decision |
|---|------|-------------|-------------------|
| Q-01 | チャット grounding | **既定 OFF**（スキャンのみ ON）。コード `chat.ts` から `googleSearch` を外す | D-24 |
| Q-02 | AI モデル・単価前提 | 利用モデルは **`gemini-3.5-flash-lite`**。ドキュメントとコード既定を統一。月次で実請求を監視 | D-25 |
| Q-03 | Free 15 回/月 | **初期確定**。Phase 0 の p50/p90 で必要なら数値のみ見直し | D-26 |
| Q-04 | コンビニ・キャリア決済 | **初期は出さない**。カード + Apple Pay / Google Pay のみ | D-27 |
| Q-05 | 画質プラン差別化 | **初期見送り** | D-28 |
| Q-06 | ギフト・家族プラン | **第 2 フェーズ** | D-28 |
| Q-07 | 初期ロイヤルティ価格 | **実施しない**（必要なら期間限定クーポン） | D-28 |
| Q-08 | 特商法 住所・電話省略 | **全記載が原則**。省略は弁護士確認後の例外のみ | D-29 |
| Q-09 | 年額プラン初期同梱 | **初期は月額のみ**。年額は第 2 弾 | D-30 |
| Q-10 | 全削除時の解約 | **即時 cancel・返金なし**（規約明記） | D-31 / D-18 |
| Q-11 | 価格最終確定 | **月額 480 円（税込）で確定**。年額 4,800 円は第 2 弾用の設計値 | D-01 / D-30 |

### 実装・運用で残る作業（判断ではない）

1. 特商法ページの **実値記入**（氏名・住所・電話・メール）と、リリース前の **弁護士・税理士による文言確認**（方針は確定済み）。
2. Phase 0（`BILLING_MODE=meter`）の実測 → Free 枠の数値微調整の要否。
3. 月次: grounding 課金回数と Gemini 実請求の監視。

---

## 16. 受け入れ条件 / 検証方法

### 受け入れ条件

1. `BILLING_MODE=off` で全既存機能が現状と完全同一に動作し、`meter` では usage の DB 書き込み以外の挙動差がない（回帰）。
2. Free ユーザーの 16 回目のスキャンがサーバー側で拒否され、ペイウォールが表示される。並行リクエストでも上限を超えない。
3. Checkout 完了 → 10 秒以内に設定画面が「撮るほどプラス」表示になり、スキャン上限が解放される。
4. Portal で期間末解約 → アプリに「◯月◯日まで」表示 → 期間末経過後 Free に自動降格し、既存記録・履歴・地図は全て閲覧可能。
5. webhook を止めた状態で購読 → 再開後の再送 or reconcile で状態が自己修復する。
6. 全データ削除実行時、有効サブスクが Stripe 側で cancel されてからデータが消える。cancel 失敗時は削除が中断されエラーが返る。
7. `/legal/tokushoho` が存在し、申込確認画面に法定 6 項目が表示される。
8. `NEXT_PUBLIC_` の Stripe 変数が存在しない。クライアントから price/customer ID を受け取る経路が存在しない。

### E2E 検証（テストモード）

| # | 手順 | 期待 |
|---|------|------|
| ① | `4242 4242 4242 4242` で購読 | subscriptions が active、entitlement=plus |
| ② | `4000 0025 0000 3155`（3DS 必須） | 認証フロー完走後に active |
| ③ | `4000 0000 0000 9995`（残高不足） | hosted Checkout ではカード拒否時にユーザーが決済画面に留まり、通常 subscription 自体が作られない見込み → 「subscription 行なし・free のまま」を確認（incomplete 状態を再現する場合は API 直で作成。要実機確認） |
| ④ | Portal で期間末解約 → テストクロック or 即時キャンセル | cancelAtPeriodEnd 表示 → free 化 |
| ⑤ | webhook 停止中に購読 → 再開 | 再送で回復 |
| ⑥ | reconcile 手動実行 | 差分修復される |
| ⑦ | Free で 15 回消費 → 16 回目 | LIMIT_REACHED、Blob/Gemini を呼ばない |
| ⑧ | スキャン失敗（Gemini エラー） | カウント返金される |
| ⑨ | 同一記録でチャット 3 往復 → 4 往復目（Free） | CHAT_RECORD_LIMIT_REACHED。加えて未保存（pending）チャットを空履歴申告で連打 → 月次プール 45 到達で CHAT_LIMIT_REACHED |
| ⑩ | Checkout Session を 2 本作成し、片方完了後にもう片方も完了 | sync / reconcile が active 重複を検知し、新しい方が自動 cancel される |

### 監視

- webhook の 5xx 率・reconcile の差分検出数・`processedAt` null の滞留（クラッシュ検出）・**同一 userId の active 重複件数**をログ監視。
- 月次で「grounding 課金回数 / 無料枠 5,000」と Gemini 実請求を確認（チャット grounding OFF 後もスキャン分が枠を食い潰していないか）。
