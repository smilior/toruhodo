import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  dialect: "turso",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    // ローカル file: URL では空文字で可。リモート Turso では必須。
    authToken: process.env.TURSO_AUTH_TOKEN ?? "",
  },
});
