// Applies the canonical schema to the test D1 binding (miniflare, local).
import schemaSql from "../../database/schemas/schema-canonical.sql?raw";

/** Drop every table and recreate the canonical schema. */
export async function resetDatabase(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .all<{ name: string }>();
  for (const { name } of results) {
    await db.prepare(`DROP TABLE IF EXISTS "${name}"`).run();
  }

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
