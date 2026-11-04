"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { postOrderPaid, postPayout, postProviderFee, reverseTransaction } from "@/lib/ledgerPosting";

const back = (path: string, q: { msg?: string; error?: string }) => redirect(`${path}?${new URLSearchParams(q as Record<string, string>).toString()}`);
const msgOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function addProviderFee(fd: FormData) {
  const user = await requirePermission("sellers");
  const amount = Math.round(Number(fd.get("amount")) * 100) / 100;
  const key = String(fd.get("key") || "");
  if (!key) back("/admin/finance/fees", { error: "Form expired — reload the page." });
  try {
    const tx = await postProviderFee({ amount, note: String(fd.get("note") || "").trim() || undefined, idempotencyKey: key });
    await logActivity(user, "created", "ledger", `Provider fee AED ${amount} posted`, tx.id);
  } catch (e) {
    back("/admin/finance/fees", { error: msgOf(e) });
  }
  revalidatePath("/admin/finance", "layout");
  back("/admin/finance/fees", { msg: "Provider fee posted." });
}

/** Posts a NEW reversing journal. The original is never edited. */
export async function reverseEntry(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = String(fd.get("id"));
  const reason = String(fd.get("reason") || "").trim();
  if (reason.length < 5) back(`/admin/finance/ledger/${id}`, { error: "Enter a reason (at least 5 characters)." });
  try {
    const rev = await reverseTransaction(id, reason);
    await logActivity(user, "reversed", "ledger", `Posted correcting entry for ledger transaction ${id}: ${reason}`, rev.id);
  } catch (e) {
    back(`/admin/finance/ledger/${id}`, { error: msgOf(e) });
  }
  revalidatePath("/admin/finance", "layout");
  back(`/admin/finance/ledger/${id}`, { msg: "Correcting entry posted." });
}

export async function postOrderNow(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = String(fd.get("id"));
  try {
    await postOrderPaid(id);
    await logActivity(user, "posted", "ledger", `Posted missing ORDER_PAID journal for order ${id}`, id);
  } catch (e) {
    back("/admin/finance/reconciliation", { error: msgOf(e) });
  }
  revalidatePath("/admin/finance", "layout");
  back("/admin/finance/reconciliation", { msg: "Journal posted." });
}

export async function postPayoutNow(fd: FormData) {
  const user = await requirePermission("sellers");
  const id = String(fd.get("id"));
  try {
    await postPayout(id);
    await logActivity(user, "posted", "ledger", `Posted missing PAYOUT journal for payout ${id}`, id);
  } catch (e) {
    back("/admin/finance/reconciliation", { error: msgOf(e) });
  }
  revalidatePath("/admin/finance", "layout");
  back("/admin/finance/reconciliation", { msg: "Journal posted." });
}
