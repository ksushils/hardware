import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

// Creates a fresh, isolated SQLite database for the test run (never touches dev.db / prod data).
export default function setup() {
  const dir = path.join(process.cwd(), "tests", ".tmp");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const url = `file:${path.join(dir, "test.db")}`;
  process.env.DATABASE_URL = url;
  execSync("npx prisma db push --skip-generate --accept-data-loss", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
  return () => rmSync(dir, { recursive: true, force: true });
}
