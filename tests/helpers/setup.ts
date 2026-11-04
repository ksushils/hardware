import path from "node:path";
// Every test worker uses the isolated DB created in globalSetup and a throwaway private-files dir.
process.env.DATABASE_URL = `file:${path.join(process.cwd(), "tests", ".tmp", "test.db")}`;
process.env.PRIVATE_DIR = path.join(process.cwd(), "tests", ".tmp", "private");
process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
