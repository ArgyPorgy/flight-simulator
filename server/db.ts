import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Ensure SSL is enabled for the connection
const connectionString = process.env.DATABASE_URL;
const poolConfig = connectionString?.includes('sslmode=')
  ? { connectionString }
  : {
      connectionString,
      ssl: connectionString?.includes('localhost') || connectionString?.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false }
    };

export const pool = new Pool(poolConfig);
export const db = drizzle(pool, { schema });
