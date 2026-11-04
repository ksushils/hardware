import { parseSnapshot, returnWindowInfo, warrantyInfo, type Locale } from "@/lib/caseLabels";

const PROVIDER: Record<string, [string, string]> = { SELLER: ["the seller", "البائع"], MANUFACTURER: ["the manufacturer", "الشركة المصنعة"], KARAT: ["Karat", "Karat"], NONE: ["none", "لا يوجد"] };

/**
 * The terms the buyer agreed to at checkout (snapshot copied at case creation), never the seller's current settings.
 * `buyer` switches the wording to a gentle, informational tone.
 */
export default function PolicyInfo({ snapshot, locale = "en", buyer = false }: { snapshot: string | null; locale?: Locale; buyer?: boolean }) {
  const ar = locale === "ar";
  const snap = parseSnapshot(snapshot);
  if (!snap.item && !snap.warranty && !snap.returns) return null;
  const w = warrantyInfo(snap);
  const r = returnWindowInfo(snap);
  const cond = (snap.condition ?? {}) as Record<string, unknown>;
  const provider = w?.provider ? PROVIDER[w.provider]?.[ar ? 1 : 0] ?? w.provider : null;
  const rows: [string, React.ReactNode][] = [];
  if (snap.sellerName) rows.push([ar ? "البائع" : "Sold by", snap.sellerName]);
  if (cond.conditionType || cond.cosmeticGrade) rows.push([ar ? "الحالة وقت الشراء" : "Condition when bought", [cond.conditionType, cond.cosmeticGrade].filter(Boolean).join(" · ")]);
  if (typeof cond.batteryHealth === "number") rows.push([ar ? "صحة البطارية المعلنة" : "Battery health declared", `${cond.batteryHealth}%`]);
  if (cond.verification) rows.push([ar ? "مستوى التحقق" : "Verification", cond.verification === "PLATFORM_VERIFIED" ? (ar ? "تم التحقق من Karat" : "Verified by Karat") : cond.verification === "SELLER_DECLARED" ? (ar ? "إقرار من البائع" : "Seller-declared") : ar ? "غير مقدم" : "Not supplied"]);
  if (w) rows.push([ar ? "الضمان" : "Warranty", ar ? `${w.months} شهرًا من ${provider} · ${w.daysLeft > 0 ? `متبقي ${w.daysLeft} يومًا` : "انتهى"}` : `${w.months} months from ${provider} · ${w.daysLeft > 0 ? `${w.daysLeft} days left` : "ended"}`]);
  if (r) rows.push([ar ? "نافذة الإرجاع" : "Return window", ar ? `${r.days} يومًا من الاستلام · ${r.daysLeft > 0 ? `متبقي ${r.daysLeft} يومًا` : "انتهت"}` : `${r.days} days from delivery · ${r.daysLeft > 0 ? `${r.daysLeft} days left` : "ended"}`]);
  if (!rows.length) return null;
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-sm">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{ar ? "الشروط وقت الشراء" : "Terms at the time of purchase"}</p>
      <dl className="space-y-1">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-end font-medium">{v}</dd></div>)}
      </dl>
      {snap.source === "settings-fallback" && <p className="mt-2 text-xs text-slate-400">{ar ? "طلب قديم: تم استخدام الشروط الافتراضية للمتجر." : "Older order: store default terms are shown."}</p>}
      {buyer && <p className="mt-2 text-xs text-slate-500">{ar ? "للعلم فقط: حقوقك القانونية كمستهلك تسري دائمًا، ويمكنك فتح طلب دعم في أي وقت." : "For information only: your statutory consumer rights always apply, and you can open a case at any time."}</p>}
    </div>
  );
}
