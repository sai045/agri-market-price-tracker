import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const migrationPath = path.resolve(__dirname, "../../../db/migrations/001_init.sql");
  const sql = await fs.readFile(migrationPath, "utf8");
  await pool.query(sql);
  await pool.end();
  console.log("Migration completed.");
}

main().catch(async (error) => {
  console.error("Migration failed:", error);
  await pool.end();
  process.exit(1);
});
