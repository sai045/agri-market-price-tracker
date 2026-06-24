import { Pool } from "pg";
import { config } from "./config.js";

function boolFromEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  return !(normalized === "0" || normalized === "false" || normalized === "no");
}

function resolveSslConfig() {
  const fromUrl = (() => {
    try {
      const parsed = new URL(config.databaseUrl);
      return parsed.searchParams.get("sslmode");
    } catch {
      return null;
    }
  })();
  const sslMode = (process.env.PGSSLMODE ?? fromUrl ?? "").toLowerCase();
  const useSsl = ["require", "prefer", "verify-ca", "verify-full"].includes(sslMode);

  if (!useSsl) return undefined;

  return {
    rejectUnauthorized: boolFromEnv("PGSSLREJECTUNAUTHORIZED", false),
  };
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: resolveSslConfig(),
});

export async function query<T = unknown>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
