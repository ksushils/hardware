import type { ThreadMessage } from "@/lib/cases";
import type { Locale } from "@/lib/caseLabels";

const ROLE: Record<string, [string, string]> = { BUYER: ["Customer", "العميل"], SELLER: ["Seller", "البائع"], STAFF: ["Karat support", "دعم Karat"], SYSTEM: ["System", "النظام"] };
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Conversation. `viewer` decides which side is shown as "you"; internal staff notes are styled distinctly (staff views only). */
export default function Thread({ messages, viewer, locale = "en" }: { messages: ThreadMessage[]; viewer: "BUYER" | "SELLER" | "STAFF"; locale?: Locale }) {
  const ar = locale === "ar";
  if (!messages.length) return <p className="text-sm text-slate-500">{ar ? "لا توجد رسائل بعد." : "No messages yet."}</p>;
  return (
    <ol className="space-y-3" aria-label={ar ? "المحادثة" : "Conversation"}>
      {messages.map((m) => {
        const mine = m.authorRole === viewer;
        const system = m.authorRole === "SYSTEM";
        if (system)
          return (
            <li key={m.id} className="text-center text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-3 py-1">{m.body}</span>
              <span className="ms-2">{m.createdAt.toLocaleString(ar ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" })}</span>
            </li>
          );
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[88%] rounded-2xl border px-4 py-3 text-sm ${m.internal ? "border-amber-300 bg-amber-50" : mine ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-white"}`}>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                <b className="text-slate-700">{m.authorName}</b>
                <span>{ROLE[m.authorRole]?.[ar ? 1 : 0] ?? m.authorRole}</span>
                {m.internal && <span className="rounded bg-amber-200 px-1.5 py-0.5 font-bold text-amber-900">🔒 {ar ? "ملاحظة داخلية" : "Private note: staff only"}</span>}
                <span>{m.createdAt.toLocaleString(ar ? "ar-AE" : "en-AE", { dateStyle: "medium", timeStyle: "short" })}</span>
              </p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-slate-800">{m.body}</p>
              {m.files.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {m.files.map((f) => (
                    <li key={f.id}>
                      <a href={f.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-slate-500">
                        {f.mime === "application/pdf" ? "📄" : "🖼️"} <span className="max-w-40 truncate" dir="ltr">{f.filename}</span> <span className="text-slate-400">{fmtSize(f.size)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
