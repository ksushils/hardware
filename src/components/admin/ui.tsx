// Shared admin UI primitives (server-safe). Client-only pieces live in ./client.tsx
import Link from "next/link";

export function PageHeader({ title, back, actions, subtitle }: { title: React.ReactNode; back?: string; actions?: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {back && <Link href={back} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-100" aria-label="Back">←</Link>}
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "", pad = true }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

const tones = {
  green: "bg-emerald-100 text-emerald-800", yellow: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-700",
  blue: "bg-sky-100 text-sky-800", gray: "bg-slate-100 text-slate-700", purple: "bg-violet-100 text-violet-800",
} as const;
export type Tone = keyof typeof tones;
export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

const statusTone: Record<string, Tone> = {
  PAID: "green", PENDING: "yellow", FAILED: "red", REFUNDED: "gray", PARTIALLY_REFUNDED: "yellow", VOIDED: "gray",
  UNFULFILLED: "yellow", FULFILLED: "blue", DELIVERED: "green", RETURNED: "gray",
  OPEN: "blue", DRAFT: "gray", CANCELLED: "red", ARCHIVED: "gray",
  ACTIVE: "green", REQUESTED: "yellow", APPROVED: "blue", REJECTED: "red", RECEIVED: "purple",
  PUBLISHED: "green", HIDDEN: "gray", PROCESSING: "blue", SHIPPED: "purple", SUSPENDED: "red", NEW: "yellow", QUOTED: "blue", COLLECTED: "purple",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? "gray"}>{status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-2xl">📦</div>
      <p className="font-semibold">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Link-based filter tabs, e.g. All / Active / Draft / Archived. */
export function Tabs({ tabs, current }: { tabs: { label: string; href: string; key: string; count?: number }[]; current: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-2">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${t.key === current ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
          {t.label}{t.count != null && <span className="ms-1 text-xs text-slate-400">{t.count}</span>}
        </Link>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, makeHref }: { page: number; pageSize: number; total: number; makeHref: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-slate-500">Page {page} of {pages} · {total} total</span>
      <div className="flex gap-2">
        {page > 1 ? <Link href={makeHref(page - 1)} className="btn-a">← Prev</Link> : <span className="btn-a opacity-40">← Prev</span>}
        {page < pages ? <Link href={makeHref(page + 1)} className="btn-a">Next →</Link> : <span className="btn-a opacity-40">Next →</span>}
      </div>
    </div>
  );
}

export function Field({ label, help, children, className = "" }: { label: string; help?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {help && <span className="mt-1 block text-xs text-slate-500">{help}</span>}
    </label>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

/** Simple dependency-free bar chart (SVG). */
export function BarChart({ data, height = 180, format = (n: number) => String(n) }: { data: { label: string; value: number }[]; height?: number; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-44 w-full">
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 10);
          return (
            <rect key={i} x={i * w + w * 0.15} y={height - h} width={w * 0.7} height={h} rx={0.6} className="fill-emerald-600">
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0]?.label}</span><span>{data[Math.floor(data.length / 2)]?.label}</span><span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

export const th = "px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-slate-500";
export const td = "px-4 py-3 align-middle";
