// Makes the ledger tables append-only at the DATABASE level (SQLite). Idempotent; run after `prisma db push`.
//   npx tsx scripts/apply-ledger-triggers.ts
// Postgres equivalent: see docs/finance.md ("Immutability").
import { PrismaClient } from "@prisma/client";

const STATEMENTS = [
  `CREATE TRIGGER IF NOT EXISTS ledger_line_no_update BEFORE UPDATE ON "LedgerLine" BEGIN SELECT RAISE(ABORT, 'ledger is immutable: post a reversing journal instead'); END;`,
  `CREATE TRIGGER IF NOT EXISTS ledger_line_no_delete BEFORE DELETE ON "LedgerLine" BEGIN SELECT RAISE(ABORT, 'ledger is immutable: post a reversing journal instead'); END;`,
  `CREATE TRIGGER IF NOT EXISTS ledger_tx_no_update BEFORE UPDATE ON "LedgerTransaction" BEGIN SELECT RAISE(ABORT, 'ledger is immutable: post a reversing journal instead'); END;`,
  `CREATE TRIGGER IF NOT EXISTS ledger_tx_no_delete BEFORE DELETE ON "LedgerTransaction" BEGIN SELECT RAISE(ABORT, 'ledger is immutable: post a reversing journal instead'); END;`,
];
const NAMES = ["ledger_line_no_update", "ledger_line_no_delete", "ledger_tx_no_update", "ledger_tx_no_delete"];

export async function applyLedgerTriggers(db: PrismaClient) {
  for (const sql of STATEMENTS) await db.$executeRawUnsafe(sql);
}
/** DEV/TEST ONLY (e.g. the demo seed wipe). Never call this in production code paths. */
export async function dropLedgerTriggers(db: PrismaClient) {
  for (const n of NAMES) await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${n};`);
}

if (process.argv[1]?.endsWith("apply-ledger-triggers.ts")) {
  const db = new PrismaClient();
  applyLedgerTriggers(db)
    .then(() => console.log("ledger triggers applied (UPDATE/DELETE on LedgerLine + LedgerTransaction now abort)"))
    .finally(() => db.$disconnect());
}
