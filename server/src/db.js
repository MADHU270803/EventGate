import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

// A "pool" keeps a few database connections open and reuses them.
// The connection string already says sslmode=require, so the connection
// is encrypted and the server's certificate is checked.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});