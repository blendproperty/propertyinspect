// Applies pending database migrations. Runs automatically when the Docker container starts.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
for (let attempt = 1; ; attempt++) {
  try {
    await migrate(drizzle(pool), { migrationsFolder: process.env.MIGRATIONS_DIR ?? "./drizzle" });
    console.log("Database is up to date.");
    break;
  } catch (e) {
    if (attempt >= 10) throw e;
    console.log(`Waiting for the database (${attempt})…`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
await pool.end();
