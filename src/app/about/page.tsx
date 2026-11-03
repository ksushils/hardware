import Prose from "@/components/Prose";
import { CONDITIONS, CONDITION_ORDER } from "@/lib/format";
export const metadata = { title: "About Us" };
export default function About() {
  return (
    <Prose title="About TechRevive">
      <p>TechRevive is a UAE marketplace for certified renewed and new PC hardware. We believe high-performance computing should be affordable, and that good hardware deserves a second life instead of a landfill.</p>
      <p>Every renewed part goes through our Dubai test lab before it&apos;s listed. Where relevant, that includes stress and thermal testing, benchmarks against reference scores, SMART health checks for drives, MemTest86 for memory and dead-pixel checks for displays.</p>
      <h2 id="grading">Our grading</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {CONDITION_ORDER.map((c) => (
          <div key={c} className="card p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${CONDITIONS[c].color}`}>{CONDITIONS[c].label}</span><p className="mt-2 text-sm">{CONDITIONS[c].desc}</p></div>
        ))}
      </div>
      <h2>For businesses</h2>
      <p>Equipping an office, school or render farm? We offer volume pricing, VAT invoices and asset-tagging. Email <b>business@techrevive.ae</b>.</p>
    </Prose>
  );
}
