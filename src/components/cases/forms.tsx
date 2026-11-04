"use client";
import { useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { useI18n } from "@/components/I18nProvider";
import { REPAIR_STATUSES, PROPOSALS, repairLabel, resolutionLabel, type Locale } from "@/lib/caseLabels";

type State = { error?: string; ok?: string } | undefined;
type Action = (s: State, fd: FormData) => Promise<State>;
export type Ui = "store" | "portal";

const C = {
  store: { input: "input", btn: "btn-primary", ghost: "btn-outline", danger: "btn-outline text-red-600", label: "label" },
  portal: { input: "in-a", btn: "btn-a-primary", ghost: "btn-a", danger: "btn-a-danger", label: "mb-1 block text-sm font-medium text-slate-700" },
} as const;
const useLang = (lang?: Locale): Locale => { const { locale } = useI18n(); return lang ?? locale; };
const Msg = ({ state }: { state: State }) => (
  <>
    {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{state.error}</p>}
    {state?.ok && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">✓ {state.ok}</p>}
  </>
);
const FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const Hidden = ({ number, k }: { number: string; k?: string | null }) => (<><input type="hidden" name="number" value={number} />{k && <input type="hidden" name="k" value={k} />}</>);

/** Reply box with evidence attachments (buyer, seller). */
export function CaseMessageForm({ action, number, k, ui = "store", lang, placeholder }: { action: Action; number: string; k?: string | null; ui?: Ui; lang?: Locale; placeholder?: string }) {
  const l = useLang(lang), ar = l === "ar", c = C[ui];
  const { state, pending, formProps } = useFormAction(action, true);
  return (
    <form {...formProps} className="space-y-3">
      <Hidden number={number} k={k} />
      <label className="block">
        <span className={c.label}>{ar ? "اكتب رسالة" : "Write a message"}</span>
        <textarea name="body" rows={3} required className={c.input} placeholder={placeholder ?? (ar ? "اكتب ردك هنا…" : "Write your reply…")} />
      </label>
      <label className="block">
        <span className={c.label}>{ar ? "إرفاق صور أو ملفات (اختياري، حتى 5 ملفات، 10 ميغابايت لكل ملف)" : "Attach photos or documents (optional, up to 5 files, 10MB each)"}</span>
        <input type="file" name="files" multiple accept={FILE_ACCEPT} className="block w-full text-sm file:me-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm" />
      </label>
      <Msg state={state} />
      <button className={c.btn} disabled={pending}>{pending ? (ar ? "جارٍ الإرسال…" : "Sending…") : ar ? "إرسال" : "Send"}</button>
    </form>
  );
}

/** One textarea + button: escalate, reopen, decline etc. */
export function ReasonForm({ action, number, k, ui = "store", lang, label, placeholder, submit, tone = "ghost", minLength = 5, hidden }: {
  action: Action; number: string; k?: string | null; ui?: Ui; lang?: Locale; label: string; placeholder?: string; submit: string; tone?: "btn" | "ghost" | "danger"; minLength?: number; hidden?: Record<string, string>;
}) {
  const l = useLang(lang), c = C[ui];
  const { state, pending, formProps } = useFormAction(action);
  const [open, setOpen] = useState(false);
  if (state?.ok) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">✓ {state.ok}</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={c[tone]}>{label}</button>;
  return (
    <form {...formProps} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <Hidden number={number} k={k} />
      {hidden && Object.entries(hidden).map(([n, v]) => <input key={n} type="hidden" name={n} value={v} />)}
      <label className="block"><span className={c.label}>{label}</span><textarea name="reason" rows={3} minLength={minLength} required placeholder={placeholder} className={c.input} /></label>
      <Msg state={state} />
      <div className="flex gap-2">
        <button className={c.btn} disabled={pending}>{submit}</button>
        <button type="button" onClick={() => setOpen(false)} className={c.ghost}>{l === "ar" ? "إلغاء" : "Cancel"}</button>
      </div>
    </form>
  );
}

/** Buyer: accept or decline a proposed resolution. */
export function ProposalResponse({ accept, decline, number, k, lang }: { accept: Action; decline: Action; number: string; k?: string | null; lang?: Locale }) {
  const l = useLang(lang), ar = l === "ar";
  const a = useFormAction(accept);
  const d = useFormAction(decline);
  const done = a.state?.ok || d.state?.ok;
  if (done) return <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status">✓ {done}</p>;
  return (
    <div className="space-y-3">
      <form {...a.formProps}>
        <Hidden number={number} k={k} /><input type="hidden" name="accept" value="1" />
        <Msg state={a.state} />
        <button className="btn-primary w-full" disabled={a.pending}>{ar ? "قبول الحل المقترح" : "Accept this resolution"}</button>
      </form>
      <form {...d.formProps} className="space-y-2">
        <Hidden number={number} k={k} /><input type="hidden" name="accept" value="0" />
        <label className="block"><span className="label">{ar ? "لا يناسبني: لماذا؟" : "Doesn't work for you? Tell us why"}</span><textarea name="comment" rows={2} className="input" /></label>
        <Msg state={d.state} />
        <button className="btn-outline w-full" disabled={d.pending}>{ar ? "رفض وتصعيد إلى الدعم" : "Decline and ask Karat to decide"}</button>
      </form>
    </div>
  );
}

/** Seller: propose a resolution. Refunds are only executed by Karat once the buyer agrees. */
export function ProposeForm({ action, number, cap }: { action: Action; number: string; cap: number }) {
  const { state, pending, formProps } = useFormAction(action);
  const [type, setType] = useState<string>("REFUND");
  const c = C.portal;
  return (
    <form {...formProps} className="space-y-3">
      <Hidden number={number} />
      <label className="block"><span className={c.label}>Resolution</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={c.input}>{PROPOSALS.map((p) => <option key={p} value={p}>{resolutionLabel(p, "en")}</option>)}</select>
      </label>
      {type === "PARTIAL_REFUND" && (
        <label className="block"><span className={c.label}>Refund amount (AED, up to {cap})</span><input name="amount" type="number" min="1" max={cap} step="0.01" required className={c.input} /></label>
      )}
      {type === "REFUND" && <p className="text-sm text-slate-600">Full refund of AED {cap} for this item.</p>}
      <label className="block"><span className={c.label}>Message to the buyer (optional)</span><textarea name="note" rows={2} className={c.input} /></label>
      <Msg state={state} />
      <button className={c.btn} disabled={pending}>{pending ? "Sending…" : "Send proposal"}</button>
      <p className="text-xs text-slate-500">If the buyer accepts, Karat carries out the refund and it is deducted from your earnings for this item.</p>
    </form>
  );
}

export function RepairForm({ action, number, current }: { action: Action; number: string; current: string | null }) {
  const { state, pending, formProps } = useFormAction(action);
  const c = C.portal;
  return (
    <form {...formProps} className="flex flex-wrap items-end gap-2">
      <Hidden number={number} />
      <label className="block min-w-48 flex-1"><span className={c.label}>Repair / replacement progress</span>
        <select name="status" defaultValue={current ?? "RECEIVED"} className={c.input}>{REPAIR_STATUSES.map((r) => <option key={r} value={r}>{repairLabel(r, "en")}</option>)}</select>
      </label>
      <button className={c.btn} disabled={pending}>Update</button>
      <div className="w-full"><Msg state={state} /></div>
    </form>
  );
}

/** Button that asks for confirmation, then runs an action (withdraw a case). */
export function ConfirmForm({ action, number, k, label, confirm: msg, lang }: { action: Action; number: string; k?: string | null; label: string; confirm: string; lang?: Locale }) {
  useLang(lang);
  const { state, pending, formProps } = useFormAction(action);
  if (state?.ok) return <p className="text-sm text-slate-600">✓ {state.ok}</p>;
  return (
    <form {...formProps} onSubmit={(e) => { if (!window.confirm(msg)) { e.preventDefault(); return; } formProps.onSubmit(e); }}>
      <Hidden number={number} k={k} />
      {state?.error && <p className="mb-1 text-sm text-red-600">{state.error}</p>}
      <button className="text-sm text-slate-500 underline hover:text-red-600" disabled={pending}>{label}</button>
    </form>
  );
}
