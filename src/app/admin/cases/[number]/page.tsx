import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { aed } from "@/lib/format";
import { canTransition, getCaseForStaff, refundCap, threadFor, REOPEN_WINDOW_DAYS } from "@/lib/cases";
import { DECISIONS, PROPOSALS, REPAIR_STATUSES, parseProposal, parseSnapshot, repairLabel, resolutionLabel, slaState, statusLabel, typeLabel, warrantyInfo, returnWindowInfo } from "@/lib/caseLabels";
import { Card, Field, PageHeader } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import { Banner, type SP } from "@/components/admin/sales/queries";
import { CaseStatusBadge, SlaBadge } from "@/components/cases/badges";
import Thread from "@/components/cases/Thread";
import PolicyInfo from "@/components/cases/PolicyInfo";
import { staffAssign, staffDecide, staffMessage, staffPropose, staffRepair, staffRequestInfo, staffSetStatus } from "@/app/actions/admin/cases";

export const metadata = { title: "Support case" };

export default async function AdminCase({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<SP> }) {
  const user = await requirePermission("orders");
  const { number } = await params;
  const sp = await searchParams;
  const c = await getCaseForStaff(number);
  if (!c) notFound();
  const thread = await threadFor(c.id, c.messages);
  const staff = (await db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] }, disabled: false }, select: { id: true, name: true, role: true, permissions: true } })).filter((u) => hasPermission(u, "orders"));
  const snap = parseSnapshot(c.policySnapshot);
  const proposal = parseProposal(c.proposedResolution);
  const final = c.status === "RESOLVED" || c.status === "CLOSED";
  const item = c.order?.items.find((i) => i.id === c.orderItemId) ?? null;
  const { cap, line, orderLeft } = await refundCap(c.id);
  const w = warrantyInfo(snap), r = returnWindowInfo(snap);
  const sla = slaState(c);
  const accepted = proposal?.response === "ACCEPTED" ? proposal : null;
  const hidden = <input type="hidden" name="number" value={c.number} />;
  const statuses = ["OPEN", "IN_REVIEW", "AWAITING_SELLER", "AWAITING_BUYER", "ESCALATED", "RESOLVED", "CLOSED"].filter((s) => s !== c.status && canTransition(c.status, s) && (s !== "AWAITING_SELLER" || c.sellerId));
  const repairable = c.type === "WARRANTY" || ["REPAIR", "REPLACEMENT"].includes(c.decision ?? "");

  return (
    <>
      <PageHeader
        back="/admin/cases"
        title={<span className="flex flex-wrap items-center gap-2">{c.number} <CaseStatusBadge status={c.status} /> <SlaBadge sla={sla} /></span>}
        subtitle={`${typeLabel(c.type, "en")} · opened ${c.createdAt.toLocaleString("en-AE")}`}
        actions={c.order ? <Link href={`/admin/orders/${c.order.number}`} className="btn-a">View order {c.order.number}</Link> : undefined}
      />
      <Banner sp={sp} />
      {accepted && !final && <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><b>The buyer accepted</b> the {accepted.by === "SELLER" ? "seller's" : "staff"} proposal: <b>{resolutionLabel(accepted.type, "en")}</b>{accepted.amount ? ` (AED ${accepted.amount})` : ""}. Record the decision below to carry it out.</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card title="Conversation" actions={<span className="text-xs text-slate-500">🔒 Private notes are visible to staff only</span>}>
            <Thread messages={thread} viewer="STAFF" />
          </Card>

          <Card title="Reply or add a private note">
            <form action={staffMessage} className="space-y-3">
              {hidden}
              <textarea name="body" rows={3} required className="in-a" placeholder="Message to the buyer and seller, or a private note for staff…" />
              <input type="file" name="files" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="block w-full text-sm" />
              <label className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><input type="checkbox" name="internal" /> 🔒 Private note: only staff can see this (buyer and seller will not)</label>
              <SubmitButton pendingText="Sending…">Send</SubmitButton>
            </form>
          </Card>

          {!final && (
            <>
              <Card title="Ask for more information">
                <div className="grid gap-3 md:grid-cols-2">
                  {(["buyer", "seller"] as const).map((who) => (
                    <form key={who} action={staffRequestInfo} className="space-y-2">
                      {hidden}<input type="hidden" name="from" value={who} />
                      <textarea name="body" rows={2} required placeholder={`Question for the ${who}…`} className="in-a" disabled={who === "seller" && !c.sellerId} />
                      <SubmitButton className="btn-a" pendingText="Sending…" disabled={who === "seller" && !c.sellerId}>Ask the {who}</SubmitButton>
                    </form>
                  ))}
                </div>
              </Card>

              <Card title="Decide and carry out" actions={<span className="text-xs text-slate-500">Refundable here: {aed(cap)}{item ? ` (item ${aed(line)}, order has ${aed(orderLeft)} left)` : ""}</span>}>
                <form action={staffDecide} className="space-y-3">
                  {hidden}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Decision">
                      <select name="decision" defaultValue={accepted?.type ?? (c.requestedResolution === "OTHER" ? "REFUND" : c.requestedResolution)} className="in-a">{DECISIONS.map((d) => <option key={d} value={d}>{resolutionLabel(d, "en")}</option>)}</select>
                    </Field>
                    <Field label="Refund amount (AED)" help="Leave empty for the full refundable amount on a full refund. Needed for partial refunds.">
                      <input name="amount" type="number" step="0.01" min="0" max={cap} defaultValue={accepted?.amount ?? ""} className="in-a" />
                    </Field>
                  </div>
                  <Field label="Explanation (the buyer and seller will see this)" help="Required if you decline. Plain language, no jargon.">
                    <textarea name="note" rows={3} className="in-a" defaultValue={accepted?.note ?? ""} />
                  </Field>
                  <SubmitButton pendingText="Working…">Record decision</SubmitButton>
                  <p className="text-xs text-slate-500">Refunds go back through the original payment method and the seller's share is deducted from their earnings. Replacements and repairs hand the next step to the seller; returns create an approved return request.</p>
                </form>
              </Card>

              <Card title="Propose a resolution to the buyer">
                <form action={staffPropose} className="grid gap-3 sm:grid-cols-[200px_160px_1fr_auto] sm:items-end">
                  {hidden}
                  <Field label="Resolution"><select name="type" className="in-a">{PROPOSALS.map((p) => <option key={p} value={p}>{resolutionLabel(p, "en")}</option>)}</select></Field>
                  <Field label="Amount (partial)"><input name="amount" type="number" step="0.01" min="0" max={cap} className="in-a" /></Field>
                  <Field label="Message"><input name="note" className="in-a" /></Field>
                  <SubmitButton className="btn-a" pendingText="Sending…">Propose</SubmitButton>
                </form>
              </Card>
            </>
          )}
        </div>

        <aside className="space-y-4">
          <Card title="Details">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Buyer</dt><dd className="text-end">{c.user ? <Link href={`/admin/customers/${c.user.id}`} className="underline">{c.user.name}</Link> : "Guest"}<span className="block text-xs text-slate-500">{c.email}</span></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Seller</dt><dd className="text-end">{c.seller ? <Link href={`/admin/sellers/${c.seller.id}`} className="underline">{c.seller.shopName}</Link> : snap.sellerName ?? "Store"}{!c.seller && snap.sellerId && <span className="block text-xs text-slate-500">(seller not given this case)</span>}</dd></div>
              {item && <div className="flex justify-between gap-3"><dt className="text-slate-500">Item</dt><dd className="text-end">{item.name}{c.quantity && c.quantity > 1 ? ` × ${c.quantity}` : ""}<span className="block text-xs text-slate-500">{item.variantTitle}</span></dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Buyer wants</dt><dd>{resolutionLabel(c.requestedResolution, "en")}</dd></div>
              {c.sellerDueAt && <div className="flex justify-between gap-3"><dt className="text-slate-500">Seller due</dt><dd>{c.sellerDueAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</dd></div>}
              {c.decision && <div className="flex justify-between gap-3"><dt className="text-slate-500">Decision</dt><dd>{resolutionLabel(c.decision, "en")}{c.refundAmount > 0 ? ` · ${aed(c.refundAmount)}` : ""}</dd></div>}
              {c.resolvedAt && <div className="flex justify-between gap-3"><dt className="text-slate-500">Closed</dt><dd>{c.resolvedAt.toLocaleDateString("en-AE")}</dd></div>}
            </dl>
          </Card>

          {(c.type === "WARRANTY" || w) && w && (
            <Card title="Warranty">
              <p className={`text-sm font-semibold ${w.daysLeft > 0 ? "text-emerald-700" : "text-red-600"}`}>{w.daysLeft > 0 ? `${w.daysLeft} days remaining` : `Ended ${Math.abs(w.daysLeft)} days ago`}</p>
              <p className="mt-1 text-xs text-slate-500">{w.months} months from {w.provider?.toLowerCase() ?? "provider"}, counted from {w.fromDelivery ? "delivery" : "order date"}; ends {w.endsAt.toLocaleDateString("en-AE")}. From the terms the buyer agreed to at checkout.</p>
              {r && <p className="mt-2 text-xs text-slate-500">Return window: {r.days} days, {r.daysLeft > 0 ? `${r.daysLeft} left` : "ended"}.</p>}
              <p className="mt-2 text-xs text-slate-400">Informational only: statutory rights apply regardless.</p>
            </Card>
          )}

          <Card title="Assignment">
            <form action={staffAssign} className="flex gap-2">
              {hidden}
              <select name="assignee" defaultValue={c.assignedTo ?? ""} className="in-a"><option value="">Unassigned</option><option value="me">Me ({user.name})</option>{staff.filter((s) => s.id !== user.id).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <SubmitButton className="btn-a" pendingText="…">Save</SubmitButton>
            </form>
          </Card>

          <Card title="Status">
            <form action={staffSetStatus} className="space-y-2">
              {hidden}
              <select name="status" className="in-a">
                {statuses.map((s) => <option key={s} value={s}>{statusLabel(s, "en")}</option>)}
                {final && <option value="REOPEN">Reopen (within {REOPEN_WINDOW_DAYS} days or anytime as staff)</option>}
              </select>
              <input name="note" placeholder="Note (optional, shown in the conversation)" className="in-a" />
              <SubmitButton className="btn-a" pendingText="…">Update status</SubmitButton>
            </form>
          </Card>

          {repairable && (
            <Card title="Repair / replacement progress">
              <form action={staffRepair} className="flex gap-2">
                {hidden}
                <select name="status" defaultValue={c.repairStatus ?? "RECEIVED"} className="in-a">{REPAIR_STATUSES.map((s) => <option key={s} value={s}>{repairLabel(s, "en")}</option>)}</select>
                <SubmitButton className="btn-a" pendingText="…">Update</SubmitButton>
              </form>
              {c.repairStatus && <p className="mt-2 text-xs text-slate-500">Currently: {repairLabel(c.repairStatus, "en")}</p>}
            </Card>
          )}

          {proposal && (
            <Card title="Latest proposal">
              <p className="text-sm"><b>{resolutionLabel(proposal.type, "en")}</b>{proposal.amount ? ` (AED ${proposal.amount})` : ""} · {proposal.byName}</p>
              <p className="text-xs text-slate-500">{proposal.response ? `Buyer ${proposal.response.toLowerCase()}` : "Awaiting the buyer's response"}</p>
            </Card>
          )}
          <PolicyInfo snapshot={c.policySnapshot} locale="en" />
        </aside>
      </div>
    </>
  );
}
