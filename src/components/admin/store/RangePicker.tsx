import Link from "next/link";
import type { Range } from "./analyticsData";

export default function RangePicker({ base, range, options = ["today", "7", "30", "90", "365"], custom = true }: { base: string; range: Range; options?: string[]; custom?: boolean }) {
  const label = (k: string) => (k === "today" ? "Today" : `${k}d`);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm shadow-sm">
        {options.map((o) => (
          <Link key={o} href={`${base}?range=${o}`} className={`rounded-md px-2.5 py-1 ${range.key === o ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{label(o)}</Link>
        ))}
      </div>
      {custom && (
        <form action={base} className="flex items-center gap-1 text-sm">
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" defaultValue={iso(range.from)} className="in-a w-36 py-1" aria-label="From" />
          <span className="text-slate-400">→</span>
          <input type="date" name="to" defaultValue={iso(range.to)} className="in-a w-36 py-1" aria-label="To" />
          <button className="btn-a">Apply</button>
        </form>
      )}
    </div>
  );
}
