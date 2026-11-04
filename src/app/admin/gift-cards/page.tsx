import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, Pagination, Stat, Tabs, td, th } from "@/components/admin/ui";

export const metadata = { title: "Gift cards" };
const PAGE_SIZE = 30;

export default async function GiftCardsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  await requirePermission("products");
  const sp = await searchParams;
  const status = sp.status ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const now = new Date();
  const where: Prisma.GiftCardWhereInput = {};
  if (sp.q) where.OR = [{ code: { contains: sp.q.toUpperCase() } }, { customerEmail: { contains: sp.q.toLowerCase() } }];
  if (status === "active") Object.assign(where, { active: true, balance: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
  if (status === "used") where.balance = { lte: 0 };
  if (status === "expired") where.expiresAt = { lt: now };
  if (status === "disabled") where.active = false;
  const [total, cards, agg] = await Promise.all([
    db.giftCard.count({ where }),
    db.giftCard.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.giftCard.aggregate({ _sum: { balance: true, initialValue: true }, _count: true }),
  ]);
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/gift-cards${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader title="Gift cards" actions={<Link href="/admin/gift-cards/new" className="btn-a-primary">Issue gift card</Link>} />
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Gift cards issued" value={agg._count} />
        <Stat label="Total issued value" value={`AED ${(agg._sum.initialValue ?? 0).toLocaleString()}`} />
        <Stat label="Outstanding balance" value={`AED ${(agg._sum.balance ?? 0).toLocaleString()}`} />
      </div>
      <Card pad={false}>
        <Tabs current={status} tabs={["all", "active", "used", "expired", "disabled"].map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1), href: href({ status: k === "all" ? "" : k, page: "" }) }))} />
        <form className="border-b border-slate-100 p-3">{status !== "all" && <input type="hidden" name="status" value={status} />}<input name="q" defaultValue={sp.q} placeholder="Search code or email" className="in-a max-w-sm" /></form>
        {cards.length ? (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50"><tr><th className={th}>Code</th><th className={th}>Status</th><th className={th}>Customer</th><th className={th}>Balance</th><th className={th}>Expires</th><th className={th}>Created</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {cards.map((c) => {
                const expired = c.expiresAt && c.expiresAt < now;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className={td}><Link href={`/admin/gift-cards/${c.id}`} className="font-mono font-semibold hover:underline">•••• {c.code.slice(-4)}</Link></td>
                    <td className={td}>{!c.active ? <Badge>Disabled</Badge> : expired ? <Badge tone="red">Expired</Badge> : c.balance <= 0 ? <Badge>Used</Badge> : c.balance < c.initialValue ? <Badge tone="yellow">Partially used</Badge> : <Badge tone="green">Active</Badge>}</td>
                    <td className={td}>{c.customerEmail ?? <span className="text-slate-400">-</span>}</td>
                    <td className={td}>AED {c.balance.toLocaleString()} <span className="text-xs text-slate-400">/ {c.initialValue.toLocaleString()}</span></td>
                    <td className={td}>{c.expiresAt ? c.expiresAt.toLocaleDateString("en-AE") : "Never"}</td>
                    <td className={td}>{c.createdAt.toLocaleDateString("en-AE")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EmptyState title="No gift cards" description="Issue gift cards to customers as rewards, refunds or store credit." action={<Link href="/admin/gift-cards/new" className="btn-a-primary">Issue gift card</Link>} />}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} makeHref={(p) => href({ page: String(p) })} />
      </Card>
    </>
  );
}
