import { notFound } from "next/navigation";
import { requireSeller } from "@/lib/sellerAuth";
import { getCaseForSeller, refundCap, threadFor } from "@/lib/cases";
import { parseProposal, parseSnapshot, resolutionLabel, slaState, typeLabel, repairLabel } from "@/lib/caseLabels";
import { Card, PageHeader } from "@/components/admin/ui";
import { CaseStatusBadge, SlaBadge } from "@/components/cases/badges";
import Thread from "@/components/cases/Thread";
import PolicyInfo from "@/components/cases/PolicyInfo";
import { CaseMessageForm, ProposeForm, ReasonForm, RepairForm } from "@/components/cases/forms";
import { sellerEscalate, sellerMessage, sellerPropose, sellerRepair } from "@/app/actions/cases";

export const metadata = { title: "Support case" };

export default async function SellerCase({ params }: { params: Promise<{ number: string }> }) {
  const { seller } = await requireSeller();
  const { number } = await params;
  const c = await getCaseForSeller(number, seller.id); // scoped by sellerId: another seller's case is simply "not found"
  if (!c) notFound();
  const thread = await threadFor(c.id, c.messages);
  const snap = parseSnapshot(c.policySnapshot);
  const proposal = parseProposal(c.proposedResolution);
  const final = c.status === "RESOLVED" || c.status === "CLOSED";
  const sla = slaState(c);
  const { cap } = await refundCap(c.id);
  const repairable = c.type === "WARRANTY" || ["REPAIR", "REPLACEMENT"].includes(c.decision ?? "");
  const actionNeeded = c.status === "AWAITING_SELLER";

  return (
    <>
      <PageHeader back="/seller/cases" title={<span className="flex flex-wrap items-center gap-2">{c.number} <CaseStatusBadge status={c.status} audience="seller" /> <SlaBadge sla={sla} /></span>} subtitle={`${typeLabel(c.type, "en")} · opened ${c.createdAt.toLocaleDateString("en-AE")}`} />
      {actionNeeded && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Your response is needed.</b>{" "}
          {c.decision === "REPLACEMENT" ? "Karat approved a replacement: please send it and update the progress below." : c.decision === "REPAIR" ? "Karat approved a repair under warranty: please update the progress below as it moves forward." : "Reply to the buyer or propose a resolution before the deadline."}
          {c.sellerDueAt && <> Deadline: <b>{c.sellerDueAt.toLocaleString("en-AE", { dateStyle: "medium", timeStyle: "short" })}</b>.</>}
        </div>
      )}
      {c.decision === "RETURN" && !final && <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">Karat approved a return. Karat will arrange the collection and tell you when the item is back for inspection.</div>}
      {c.decision && c.refundAmount > 0 && <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">Karat refunded the buyer AED {c.refundAmount}. Your share of the refund is deducted from your earnings for this item.</div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {c.status === "PROPOSED" && proposal && (
            <Card title="Proposed resolution">
              <p className="text-sm"><b>{resolutionLabel(proposal.type, "en")}</b>{proposal.amount ? ` (AED ${proposal.amount})` : ""} · by {proposal.byName}</p>
              {proposal.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{proposal.note}</p>}
              <p className="mt-2 text-xs text-slate-500">{proposal.response ? `Buyer ${proposal.response.toLowerCase()} this.` : "Waiting for the buyer to accept or decline."}</p>
            </Card>
          )}
          <Card title="Conversation"><Thread messages={thread} viewer="SELLER" locale="en" /></Card>
          {!final ? (
            <>
              <Card title="Reply to the buyer"><CaseMessageForm action={sellerMessage} number={c.number} ui="portal" lang="en" placeholder="Explain what you'll do, ask for photos, etc." /></Card>
              {cap > 0 && c.status !== "PROPOSED" && <Card title="Propose a resolution"><ProposeForm action={sellerPropose} number={c.number} cap={cap} /></Card>}
              {repairable && <Card title="Repair / replacement progress"><RepairForm action={sellerRepair} number={c.number} current={c.repairStatus} /></Card>}
              {c.status !== "ESCALATED" && <ReasonForm action={sellerEscalate} number={c.number} ui="portal" lang="en" label="Ask Karat to step in" placeholder="Why do you need Karat's help?" submit="Escalate" />}
            </>
          ) : <p className="text-sm text-slate-500">This case is closed. {c.decisionNote && <>Outcome: {c.decisionNote}</>}</p>}
        </div>
        <aside className="space-y-4">
          <Card title="Case details">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Order</dt><dd>{c.order?.number}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Buyer</dt><dd>{c.order?.fullName}, {c.order?.emirate}</dd></div>
              {snap.item && <div className="flex justify-between gap-3"><dt className="text-slate-500">Item</dt><dd className="text-end">{snap.item.name}{c.quantity && c.quantity > 1 ? ` × ${c.quantity}` : ""}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Buyer wants</dt><dd>{resolutionLabel(c.requestedResolution, "en")}</dd></div>
              {c.repairStatus && <div className="flex justify-between gap-3"><dt className="text-slate-500">Repair status</dt><dd>{repairLabel(c.repairStatus, "en")}</dd></div>}
            </dl>
          </Card>
          <PolicyInfo snapshot={c.policySnapshot} locale="en" />
        </aside>
      </div>
    </>
  );
}
