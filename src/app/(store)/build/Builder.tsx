"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addBuildToCart } from "@/app/actions/cart";
import { aed, loc } from "@/lib/format";
import { useI18n } from "@/components/I18nProvider";

export type BuilderProduct = { id: string; slug: string; name: string; nameAr: string; brand: string; image: string; cat: string; priceNew: number; specs: Record<string, string>; variants: { id: string; title: string; price: number }[] };
type Slot = { key: string; cat: string; required: boolean };

const LABELS: Record<string, [string, string, string]> = {
  cpu: ["Processor", "المعالج", "🧠"], motherboard: ["Motherboard", "اللوحة الأم", "🧩"], ram: ["Memory", "الذاكرة", "💾"], gpu: ["Graphics card", "كرت الشاشة", "🎮"],
  storage: ["Storage", "التخزين", "🗄️"], psu: ["Power supply", "مزود الطاقة", "🔌"], case: ["Case", "الصندوق", "🖥️"], cooling: ["CPU cooler", "مبرد المعالج", "❄️"],
};
const watts = (s?: string) => Number((s ?? "").match(/(\d+)\s*W/i)?.[1] ?? 0);
const ddr = (s?: string) => (s ?? "").match(/DDR\d/i)?.[0]?.toUpperCase();

export default function Builder({ products, slots, initial }: { products: BuilderProduct[]; slots: Slot[]; initial: Record<string, string> }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const router = useRouter();
  const [pending, start] = useTransition();
  // selection: slot → variantId
  const [sel, setSel] = useState<Record<string, string>>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const byVariant = useMemo(() => {
    const m = new Map<string, { p: BuilderProduct; v: BuilderProduct["variants"][number] }>();
    products.forEach((p) => p.variants.forEach((v) => m.set(v.id, { p, v })));
    return m;
  }, [products]);
  const pick = (slot: string) => (sel[slot] ? byVariant.get(sel[slot]) : undefined);

  const cpu = pick("cpu")?.p, mb = pick("motherboard")?.p, ram = pick("ram")?.p, gpu = pick("gpu")?.p, psu = pick("psu")?.p, kase = pick("case")?.p, cooler = pick("cooling")?.p;

  // compatibility checks
  const issues: { level: "error" | "warn" | "ok"; msg: string }[] = [];
  if (cpu && mb) {
    const ok = cpu.specs.Socket && mb.specs.Socket && cpu.specs.Socket === mb.specs.Socket;
    issues.push(ok ? { level: "ok", msg: ar ? `المقبس متوافق (${cpu.specs.Socket})` : `CPU and motherboard sockets match (${cpu.specs.Socket})` }
      : { level: "error", msg: ar ? `المقبس غير متوافق: المعالج ${cpu.specs.Socket} واللوحة ${mb.specs.Socket}` : `Socket mismatch: CPU is ${cpu.specs.Socket}, motherboard is ${mb.specs.Socket}` });
  }
  if (ram && mb) {
    const r = ddr(ram.specs.Type), m = ddr(mb.specs.Memory);
    issues.push(r && m && r === m ? { level: "ok", msg: ar ? `نوع الذاكرة متوافق (${r})` : `Memory type matches (${r})` }
      : { level: "error", msg: ar ? `الذاكرة ${r} لا تتوافق مع اللوحة (${m})` : `${r} memory won't fit this ${m} motherboard` });
  }
  if (cooler && cpu && cooler.specs.Sockets) {
    const ok = cooler.specs.Sockets.includes(cpu.specs.Socket ?? "?");
    issues.push(ok ? { level: "ok", msg: ar ? "المبرد يدعم مقبس المعالج" : "Cooler supports the CPU socket" } : { level: "error", msg: ar ? "المبرد لا يدعم مقبس المعالج" : "Cooler doesn't list support for this CPU socket" });
  }
  if (kase && mb) {
    const ff = (mb.specs["Form Factor"] ?? "").toUpperCase();
    const ok = !ff || (kase.specs.Motherboard ?? "").toUpperCase().includes(ff.replace("MICRO-ATX", "MATX"));
    issues.push(ok ? { level: "ok", msg: ar ? `الصندوق يدعم ${ff}` : `Case fits a ${ff} motherboard` } : { level: "error", msg: ar ? `الصندوق لا يدعم لوحة ${ff}` : `Case doesn't support ${ff} motherboards` });
  }
  if (cpu && cpu.specs.Socket && !cooler && /K$|X$/.test(cpu.name.trim().split(" ").pop() ?? "")) issues.push({ level: "warn", msg: ar ? "هذا المعالج لا يأتي بمبرد — أضف مبردًا" : "This CPU doesn't include a cooler. Add one." });
  const draw = 75 + watts(cpu?.specs.TDP) * 1.5 + watts(gpu?.specs.TDP) + 25;
  const recommended = Math.ceil((draw * 1.3) / 50) * 50;
  if (psu) {
    const w = watts(psu.specs.Wattage);
    issues.push(w >= recommended ? { level: "ok", msg: ar ? `قدرة كافية: ${w}W (المقترح ${recommended}W)` : `PSU has enough headroom: ${w}W (recommended ${recommended}W)` }
      : { level: w >= draw ? "warn" : "error", msg: ar ? `مزود الطاقة ${w}W أقل من المقترح ${recommended}W` : `PSU ${w}W is below the recommended ${recommended}W` });
  }
  if (!gpu && cpu && /F$/.test(cpu.name.trim())) issues.push({ level: "error", msg: ar ? "معالجات F لا تحتوي على رسوميات مدمجة — أضف كرت شاشة" : "\"F\" CPUs have no integrated graphics. Add a graphics card." });

  const chosen = slots.map((s) => pick(s.key)).filter(Boolean) as { p: BuilderProduct; v: BuilderProduct["variants"][number] }[];
  const total = chosen.reduce((s, c) => s + c.v.price, 0);
  const totalNew = chosen.reduce((s, c) => s + Math.max(c.p.priceNew, c.v.price), 0);
  const missing = slots.filter((s) => s.required && !sel[s.key]);
  const errors = issues.filter((i) => i.level === "error").length;
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/build?${new URLSearchParams(sel).toString()}` : "";

  const choose = (slot: string, variantId: string | null) => {
    const next = { ...sel };
    if (variantId) next[slot] = variantId; else delete next[slot];
    setSel(next);
    setOpen(null);
    router.replace(`/build?${new URLSearchParams(next).toString()}`, { scroll: false });
  };
  // filter options in a slot by compatibility with current picks
  const compatible = (slot: string, p: BuilderProduct) => {
    if (slot === "motherboard" && cpu) return p.specs.Socket === cpu.specs.Socket;
    if (slot === "cpu" && mb) return p.specs.Socket === mb.specs.Socket;
    if (slot === "ram" && mb) return ddr(p.specs.Type) === ddr(mb.specs.Memory);
    if (slot === "cooling" && cpu && p.specs.Sockets) return p.specs.Sockets.includes(cpu.specs.Socket ?? "?");
    if (slot === "psu") return watts(p.specs.Wattage) >= recommended || !cpu;
    return true;
  };

  return (
    <div className="container-x py-8">
      <h1 className="text-3xl font-black">🛠️ {ar ? "جمّع جهازك" : "PC Builder"}</h1>
      <p className="mt-1 text-slate-600">{ar ? "اختر القطع وسنتحقق من التوافق والقدرة الكهربائية تلقائيًا." : "Pick your parts and we'll check compatibility and power automatically."}</p>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {slots.map((s) => {
            const c = pick(s.key);
            const [en, arl, icon] = LABELS[s.key];
            const list = products.filter((p) => p.cat === s.cat);
            return (
              <div key={s.key} className="card">
                <div className="flex items-center gap-4 p-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-2xl">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-slate-500">{ar ? arl : en}{s.required && <span className="text-accent"> *</span>}</p>
                    {c ? <p className="truncate font-semibold">{c.p.brand} {loc(locale, c.p.name, c.p.nameAr)} <span className="text-sm font-normal text-slate-500">· {c.v.title}</span></p> : <p className="text-sm text-slate-400">{ar ? "لم يتم الاختيار" : "Not selected"}</p>}
                  </div>
                  {c && <p className="font-bold">{aed(c.v.price, locale)}</p>}
                  <button type="button" onClick={() => setOpen(open === s.key ? null : s.key)} className={c ? "btn-outline px-3 py-2 text-xs" : "btn-primary px-3 py-2 text-xs"}>{c ? (ar ? "تغيير" : "Change") : (ar ? "اختر" : "Choose")}</button>
                  {c && <button type="button" onClick={() => choose(s.key, null)} className="text-slate-400 hover:text-red-600" aria-label="Remove">✕</button>}
                </div>
                {open === s.key && (
                  <div className="max-h-96 divide-y overflow-y-auto border-t border-slate-100">
                    {list.map((p) => {
                      const ok = compatible(s.key, p);
                      return (
                        <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${ok ? "" : "opacity-50"}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.image} alt="" className="h-10 w-10 rounded-lg bg-slate-50 object-contain" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{p.brand} {loc(locale, p.name, p.nameAr)}</p>
                            <p className="truncate text-xs text-slate-500">{Object.entries(p.specs).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                            {!ok && <p className="text-xs font-semibold text-red-600">{ar ? "غير متوافق مع اختياراتك" : "Not compatible with your picks"}</p>}
                          </div>
                          <select className="input w-auto py-1.5 text-xs" defaultValue="" onChange={(e) => e.target.value && choose(s.key, e.target.value)} aria-label="Variant">
                            <option value="" disabled>{ar ? "اختر الحالة" : "Select"}</option>
                            {p.variants.map((v) => <option key={v.id} value={v.id}>{v.title} · {aed(v.price, locale)}</option>)}
                          </select>
                        </div>
                      );
                    })}
                    {!list.length && <p className="p-4 text-sm text-slate-500">—</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-36">
          <h2 className="text-lg font-bold">{ar ? "ملخص التجميعة" : "Build summary"}</h2>
          <div className="rounded-xl bg-slate-50 p-3 text-sm">
            <p className="flex justify-between"><span>⚡ {ar ? "الاستهلاك المقدر" : "Estimated draw"}</span><b>{Math.round(draw)}W</b></p>
            <p className="flex justify-between"><span>{ar ? "مزود الطاقة المقترح" : "Recommended PSU"}</span><b>{recommended}W+</b></p>
          </div>
          <ul className="space-y-1.5 text-sm">
            {issues.length === 0 && <li className="text-slate-500">{ar ? "اختر القطع لرؤية فحوصات التوافق." : "Pick parts to see compatibility checks."}</li>}
            {issues.map((i, n) => <li key={n} className={i.level === "ok" ? "text-emerald-700" : i.level === "warn" ? "text-amber-700" : "font-semibold text-red-600"}>{i.level === "ok" ? "✓" : i.level === "warn" ? "⚠" : "✕"} {i.msg}</li>)}
          </ul>
          <div className="border-t pt-3">
            <p className="flex justify-between text-lg font-black"><span>{ar ? "الإجمالي" : "Total"}</span><span>{aed(total, locale)}</span></p>
            {totalNew > total && <p className="text-sm font-semibold text-brand-700">{ar ? `توفر ${aed(totalNew - total, locale)} مقارنة بالجديد` : `You save ${aed(totalNew - total, locale)} vs buying new`}</p>}
          </div>
          {missing.length > 0 && <p className="text-xs text-slate-500">{ar ? "متبقي:" : "Still needed:"} {missing.map((m) => (ar ? LABELS[m.key][1] : LABELS[m.key][0])).join(", ")}</p>}
          <button disabled={!chosen.length || pending || errors > 0} onClick={() => start(async () => { await addBuildToCart(Object.values(sel)); })} className="btn-primary w-full">
            {pending ? "…" : errors > 0 ? (ar ? "أصلح مشاكل التوافق" : "Fix compatibility issues") : (ar ? "أضف التجميعة إلى السلة" : "Add build to cart")}
          </button>
          {chosen.length > 0 && <button type="button" onClick={() => navigator.clipboard.writeText(shareUrl)} className="btn-outline w-full">🔗 {ar ? "انسخ رابط التجميعة" : "Copy share link"}</button>}
        </aside>
      </div>
    </div>
  );
}
