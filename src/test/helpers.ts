import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db, dbClient } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function applyMigrations() {
  const drizzleDir = path.join(process.cwd(), "drizzle");
  const files = (await readdir(drizzleDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(drizzleDir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await dbClient.execute(statement);
    }
  }
}

export async function seedUser(
  userId = "user_test_1",
  email = "test@example.com",
) {
  await db.insert(users).values({
    id: userId,
    name: "Test",
    email,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return userId;
}
