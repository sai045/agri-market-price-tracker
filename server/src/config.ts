import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  adminBootstrapEmail: process.env.ADMIN_BOOTSTRAP_EMAIL ?? "admin@example.com",
  adminBootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "ChangeMe123!",
};
