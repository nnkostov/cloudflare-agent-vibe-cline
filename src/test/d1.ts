// Applies the canonical schema to the test D1 binding (miniflare, local).
import schemaSql from "../../database/schemas/schema-canonical.sql?raw";

/** Drop every table and recreate the canonical schema. */
export async function resetDatabase(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .all<{ name: string }>();
  // One transaction with foreign-key checks deferred to commit, so tables
  // can be dropped in any order (D1 enforces foreign keys).
  await db.batch([
    db.prepare("PRAGMA defer_foreign_keys = true"),
    ...results.map(({ name }) => db.prepare(`DROP TABLE IF EXISTS "${name}"`)),
  ]);

  const statements = schemaSql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await db.prepare(statement).run();
  }
}
