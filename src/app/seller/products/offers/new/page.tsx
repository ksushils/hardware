import Link from "next/link";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { getSettings } from "@/lib/settings";
import { parseValues } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/admin/ui";
import OfferForm from "@/components/marketplace/OfferForm";
import { blankTerms } from "@/lib/offerTermsInitial";

export const metadata = { title: "Add offer" };

export default async function NewOffer({ searchParams }: { searchParams: Promise<{ q?: string; product?: string }> }) {
  await requireSeller();
  const sp = await searchParams;
  const s = await getSettings();

  if (sp.product) {
    const p = await db.product.findFirst({ where: { id: sp.product, status: "ACTIVE", approvalStatus: "APPROVED" }, include: { options: { orderBy: { position: "asc" } } } });
    if (!p) return <EmptyState title="Product not found" description="Choose a product from the catalogue." action={<Link href="/seller/products/offers/new" className="btn-a-primary">Search products</Link>} />;
    const options = p.options.map((o) => ({ name: o.name, values: parseValues(o.values) }));
    return (
      <>
        <PageHeader back="/seller/products/offers/new" title="Add your offer" subtitle="Your offer appears on this product page next to other sellers' offers." />
        <OfferForm product={{ id: p.id, name: `${p.brand} ${p.name}`, image: p.image }} options={options} priceNew={p.priceNew} minReturnDays={s.returnsDays}
          initial={{ options: options.map(() => null), sku: "", price: "", stock: "1", terms: blankTerms() }} />
      </>
    );
  }

  const q = (sp.q ?? "").trim();
  const products = q.length >= 2
    ? await db.product.findMany({
        where: { status: "ACTIVE", approvalStatus: "APPROVED", OR: [{ name: { contains: q } }, { brand: { contains: q } }, { tags: { contains: q } }] },
        include: { category: true, _count: { select: { variants: { where: { approvalStatus: "APPROVED" } } } } }, take: 20,
      })
    : [];
  return (
    <>
      <PageHeader back="/seller/products" title="Add offer to an existing product" subtitle="Step 1 of 2: find the product you want to sell." />
      <Card>
        <form className="flex gap-2"><input name="q" defaultValue={q} placeholder="Search by name, brand or keyword, e.g. RTX 4070" className="in-a" autoFocus /><button className="btn-a-primary">Search</button></form>
      </Card>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {products.map((p) => (
          <Link key={p.id} href={`/seller/products/offers/new?product=${p.id}`} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt="" className="h-14 w-14 rounded-lg border bg-slate-50 object-contain" />
            <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.brand} {p.name}</p><p className="text-xs text-slate-500">{p.category.name} · {p._count.variants} offer(s)</p></div>
            <span className="btn-a">Select</span>
          </Link>
        ))}
      </div>
      {q.length >= 2 && products.length === 0 && (
        <Card className="mt-4"><p className="text-sm">No product matches “{q}”. <Link href="/seller/products/new" className="font-semibold text-sky-700 underline">Create a new product</Link> for the marketplace team to approve.</p></Card>
      )}
      {q.length < 2 && <p className="mt-4 text-sm text-slate-500">Can&apos;t find it? <Link href="/seller/products/new" className="font-semibold text-sky-700 underline">Create a new product</Link> instead.</p>}
    </>
  );
}
