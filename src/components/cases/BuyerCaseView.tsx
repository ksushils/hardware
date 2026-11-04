import Link from "next/link";
import { notFound } from "next/navigation";
import { getI18n } from "@/lib/i18n";
import { aed } from "@/lib/format";
import { orderAccessKey } from "@/lib/orderAccess";
import { getCaseForBuyer, threadFor, REOPEN_WINDOW_DAYS } from "@/lib/cases";
import { buyerEscalate, buyerMessage, buyerReopen, buyerRespond, buyerWithdraw } from "@/app/actions/cases";
import { parseProposal, parseSnapshot, REPAIR_STATUSES, repairLabel, resolutionLabel, typeLabel } from "@/lib/caseLabels";
import { CaseStatusBadge } from "./badges";
import Thread from "./Thread";
import PolicyInfo from "./PolicyInfo";
import { CaseMessageForm, ConfirmForm, ProposalResponse, ReasonForm } from "./forms";

/** Shared by /account/cases/[number] (signed-in buyers) and /cases/[number]?k= (emailed link for guests). */
export default async function BuyerCaseView({ number, k, user }: { number: string; k?: string; user: { id: string } | null }) {
  const { locale } = await getI18n();
  const ar = locale === "ar";
  const c = await getCaseForBuyer(number, user, k);
  if (!c) notFound();
  const thread = await threadFor(c.id, c.messages);
  const snap = parseSnapshot(c.policySnapshot);
  const proposal = parseProposal(c.proposedResolution);
  const final = c.status === "RESOLVED" || c.status === "CLOSED";
  const canReopen = final && Date.now() - (c.resolvedAt ?? c.updatedAt).getTime() < REOPEN_WINDOW_DAYS * 86400000;
  const showRepair = !!c.repairStatus || c.type === "WARRANTY" || ["REPAIR", "REPLACEMENT"].includes(c.decision ?? "");
  const stepIdx = c.repairStatus ? REPAIR_STATUSES.indexOf(c.repairStatus as never) : -1;
  const orderHref = c.order ? `/order/${c.order.number}${!user ? `?k=${orderAccessKey(c.order.number)}` : ""}` : null;
  const back = user ? "/account/cases" : null;

  return (
    <div className={user ? "" : "container-x max-w-5xl py-10"}>
      {back && <Link href={back} className="text-sm font-semibold text-brand-700">{ar ? "→ كل طلباتي" : "← All my cases"}</Link>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-black" dir="ltr">{c.number}</h1>
        <CaseStatusBadge status={c.status} locale={locale} audience="buyer" />
      </div>
      <p className="mt-1 text-slate-600">{typeLabel(c.type, locale)} · {c.createdAt.toLocaleDateString(ar ? "ar-AE" : "en-AE", { dateStyle: "medium" })}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {c.status === "PROPOSED" && proposal && !proposal.response && (
            <section className="card border-brand-300 bg-brand-50 p-5">
              <h2 className="font-bold">{ar ? "تم اقتراح حل لطلبك" : "A resolution was proposed"}</h2>
              <p className="mt-1 text-sm">{proposal.byName}: <b>{resolutionLabel(proposal.type, locale)}</b>{proposal.amount ? ` (${aed(proposal.amount, locale)})` : ""}</p>
              {proposal.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{proposal.note}</p>}
              <div className="mt-4"><ProposalResponse accept={buyerRespond} decline={buyerRespond} number={c.number} k={k} /></div>
            </section>
          )}
          {c.decision && (
            <section className="card p-5">
              <h2 className="font-bold">{ar ? "القرار" : "Decision"}: {resolutionLabel(c.decision, locale)}</h2>
              {c.refundAmount > 0 && <p className="mt-1 text-sm text-emerald-700">{ar ? `تم استرداد ${aed(c.refundAmount, locale)} إلى وسيلة الدفع الأصلية.` : `${aed(c.refundAmount, locale)} was refunded to your original payment method.`}</p>}
              {c.decisionNote && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{c.decisionNote}</p>}
            </section>
          )}
          <section className="card p-5">
            <h2 className="mb-3 font-bold">{ar ? "المحادثة" : "Conversation"}</h2>
            <Thread messages={thread} viewer="BUYER" locale={locale} />
          </section>
          {!final ? (
            <section className="card p-5">
              <CaseMessageForm action={buyerMessage} number={c.number} k={k} />
              <div className="mt-4 flex flex-wrap items-start gap-4 border-t pt-4">
                {c.status !== "ESCALATED" && (
                  <ReasonForm action={buyerEscalate} number={c.number} k={k} label={ar ? "اطلب من Karat التدخل" : "Ask Karat to step in"} placeholder={ar ? "لماذا تحتاج إلى تدخل الدعم؟" : "Why do you need Karat's help?"} submit={ar ? "تصعيد" : "Escalate"} />
                )}
                <ConfirmForm action={buyerWithdraw} number={c.number} k={k} label={ar ? "سحب الطلب" : "Withdraw this case"} confirm={ar ? "هل تريد سحب هذا الطلب؟" : "Withdraw this case?"} />
              </div>
            </section>
          ) : canReopen ? (
            <section className="card p-5">
              <p className="mb-3 text-sm text-slate-600">{ar ? `لست راضيًا؟ يمكنك إعادة فتح الطلب خلال ${REOPEN_WINDOW_DAYS} يومًا.` : `Not happy with the outcome? You can reopen this case within ${REOPEN_WINDOW_DAYS} days.`}</p>
              <ReasonForm action={buyerReopen} number={c.number} k={k} label={ar ? "إعادة فتح الطلب" : "Reopen this case"} placeholder={ar ? "ما الذي لم يُحل؟" : "What's still not resolved?"} submit={ar ? "إعادة الفتح" : "Reopen"} minLength={10} tone="btn" />
            </section>
          ) : (
            <p className="text-sm text-slate-500">{ar ? "انتهت مدة إعادة الفتح. افتح طلبًا جديدًا مع ذكر رقم هذا الطلب." : "The reopen period has ended. Please open a new case and mention this number."}</p>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card space-y-2 p-5 text-sm">
            <h2 className="font-bold">{ar ? "ملخص" : "Summary"}</h2>
            {orderHref && <p className="flex justify-between gap-3"><span className="text-slate-500">{ar ? "الطلب" : "Order"}</span><Link href={orderHref} className="font-semibold text-brand-700 underline" dir="ltr">{c.order!.number}</Link></p>}
            {snap.item && <p className="flex justify-between gap-3"><span className="text-slate-500">{ar ? "المنتج" : "Item"}</span><span className="text-end">{snap.item.name}{c.quantity && c.quantity > 1 ? ` × ${c.quantity}` : ""}</span></p>}
            <p className="flex justify-between gap-3"><span className="text-slate-500">{ar ? "المطلوب" : "You asked for"}</span><span>{resolutionLabel(c.requestedResolution, locale)}</span></p>
            {c.seller && <p className="flex justify-between gap-3"><span className="text-slate-500">{ar ? "البائع" : "Seller"}</span><Link href={`/sellers/${c.seller.slug}`} className="text-brand-700 underline">{c.seller.shopName}</Link></p>}
          </div>
          {showRepair && (
            <div className="card p-5 text-sm">
              <h2 className="font-bold">{ar ? "حالة الإصلاح" : "Repair progress"}</h2>
              {c.repairStatus ? (
                <ol className="mt-3 space-y-2">
                  {REPAIR_STATUSES.filter((r) => r !== "REPLACED" || c.repairStatus === "REPLACED").map((r, i) => (
                    <li key={r} className={`flex items-center gap-2 ${i <= stepIdx ? "font-semibold text-brand-700" : "text-slate-400"}`}><span>{i <= stepIdx ? "✓" : "○"}</span>{repairLabel(r, locale)}</li>
                  ))}
                </ol>
              ) : <p className="mt-1 text-slate-500">{ar ? "لم يبدأ التتبع بعد." : "Tracking will appear here once the item is with the service team."}</p>}
            </div>
          )}
          <PolicyInfo snapshot={c.policySnapshot} locale={locale} buyer />
        </aside>
      </div>
    </div>
  );
}
