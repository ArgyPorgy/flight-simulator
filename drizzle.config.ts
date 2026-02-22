import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Parse DATABASE_URL and ensure SSL is configured
const dbUrl = process.env.DATABASE_URL || '';
const urlWithSSL = dbUrl.includes('sslmode=')
  ? dbUrl
  : dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? dbUrl
    : `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}sslmode=require`;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: urlWithSSL,
  },
});
