# セキュリティレビュー対応メモ（2026-07-20）

レビュー結論: Critical / High なし。以下は対応方針。

## 対応した項目

| # | 指摘 | 対応 |
|---|------|------|
| 2 | タスク名の最大長なし | `parseTaskName`（max 100）+ UI `maxLength` |
| 3 | レート制限なし | プロセス内メモリの簡易制限（作成 20/分、他ミューテーション 60/分） |
| 1 | postcss 脆弱性 | `package.json` overrides で postcss@8.5.10 を強制 |

## 意図的に触らない項目

| # | 指摘 | 理由 |
|---|------|------|
| 4 | ミドルウェアが非 `__Secure-` Cookie も見る | ローカル HTTP 開発に必要。認可境界は Server Action 側 |
| 5 | cookieCache 5分 | ログアウト遅延は最大5分。個人向けアプリとして許容 |
| 1 一部 | drizzle-kit / esbuild | devDependency のみ。`npm audit fix --force` は破壊的 |

## 本番 env（要ダッシュボード目視）

Vercel Production に設定されていること:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`

Sensitive 指定の変数は `vercel env pull` に出ないことがある（正常）。
