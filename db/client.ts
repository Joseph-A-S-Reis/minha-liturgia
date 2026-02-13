import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL não definido. Configure em .env.");
  }
  return url;
}

const sql = neon(getDatabaseUrl());

export const db = drizzle(sql);
