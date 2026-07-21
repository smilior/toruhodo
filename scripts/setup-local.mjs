#!/usr/bin/env node
/**
 * ローカル開発用の最小セットアップ:
 * - .env.local が無ければ .env.example から生成（secret 自動生成）
 * - turso dev (http://127.0.0.1:8080) への接続を既定に
 * - drizzle-kit push でスキーマ適用
 *
 * 事前に別ターミナルで `npm run db:dev` を起動しておくこと。
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env.local");
const examplePath = resolve(root, ".env.example");

function ensureLocalTursoUrl(body) {
  // ローカル開発は常に localhost Turso に固定
  let next = body.replace(
    /^TURSO_DATABASE_URL=.*$/m,
    'TURSO_DATABASE_URL="http://127.0.0.1:8080"',
  );
  if (!/^TURSO_DATABASE_URL=/m.test(next)) {
    next += '\nTURSO_DATABASE_URL="http://127.0.0.1:8080"\n';
  }
  if (!/^TURSO_AUTH_TOKEN=/m.test(next)) {
    next += 'TURSO_AUTH_TOKEN="local-dev"\n';
  } else {
    next = next.replace(/^TURSO_AUTH_TOKEN=.*$/m, 'TURSO_AUTH_TOKEN="local-dev"');
  }
  return next;
}

if (!existsSync(envPath)) {
  let body = readFileSync(examplePath, "utf8");
  const secret = randomBytes(32).toString("base64");
  body = body.replace(
    /^BETTER_AUTH_SECRET=.*$/m,
    `BETTER_AUTH_SECRET=${secret}`,
  );
  body = ensureLocalTursoUrl(body);
  writeFileSync(envPath, body);
  console.log("✓ .env.local を作成しました（BETTER_AUTH_SECRET 自動生成）");
  console.log("  TURSO_DATABASE_URL=http://127.0.0.1:8080 （localhost 固定）");
  console.log("  → GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET を埋めてください");
} else {
  let body = readFileSync(envPath, "utf8");
  const before = body;
  body = ensureLocalTursoUrl(body);
  if (body !== before) {
    writeFileSync(envPath, body);
    console.log("✓ .env.local の TURSO_* を localhost に揃えました");
  } else {
    console.log("· .env.local は既にあります（TURSO は localhost）");
  }
}

// 接続確認
try {
  execSync(
    `node -e "require('@libsql/client').createClient({url:'http://127.0.0.1:8080'}).execute('select 1').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"`,
    { cwd: root, stdio: "inherit" },
  );
} catch {
  console.error("");
  console.error("✗ ローカル Turso (http://127.0.0.1:8080) に接続できません。");
  console.error("  別ターミナルで先に起動してください:");
  console.error("    npm run db:dev");
  process.exit(1);
}

console.log("→ drizzle-kit push …");
execSync("npx drizzle-kit push --force", { cwd: root, stdio: "inherit" });
console.log("✓ DB スキーマ適用完了");
console.log("");
console.log("次のステップ:");
console.log("  1. .env.local に Google OAuth を設定");
console.log("  2. npm run db:dev   # 未起動なら");
console.log("  3. npm run dev");
console.log("  4. http://localhost:3000");
