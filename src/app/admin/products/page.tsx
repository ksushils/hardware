import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Pagination, Tabs } from "@/components/admin/ui";
import { AutoSubmitSelect } from "@/components/admin/client";
import ProductsTable, { type ProductRow } from "@/components/admin/products/ProductsTable";

export const metadata = { title: "Products" };
const PAGE_SIZE = 25;
type SP = { seller?: string; approval?: string; status?: string; q?: string; category?: string; vendor?: string; type?: string; stock?: string; sort?: string; page?: string };
type Sortable = ProductRow & { created: number; updated: number };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requirePermission("products");
  const sp = await searchParams;
  const status = ["ACTIVE", "DRAFT", "ARCHIVED"].includes(sp.status ?? "") ? sp.status! : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: Prisma.ProductWhereInput = {};
  if (status) where.status = status;
  if (sp.category) where.categoryId = sp.category;
  if (sp.vendor) where.brand = sp.vendor;
  if (sp.type) where.productType = sp.type;
  if (sp.seller === "store") where.sellerId = null;
  else if (sp.seller === "marketplace") where.sellerId = { not: null };
  else if (sp.seller) where.sellerId = sp.seller;
  if (sp.approval) where.approvalStatus = sp.approval;
  if (sp.q) {
    const q = sp.q.trim();
    where.OR = [
      { name: { contains: q } }, { nameAr: { contains: q } }, { brand: { contains: q } }, { tags: { contains: q } },
      { slug: { contains: q } }, { variants: { some: { sku: { contains: q } } } },
    ];
  }

  const [sellers, counts, categories, vendors, types, list] = await Promise.all([
    db.seller.findMany({ select: { id: true, shopName: true }, orderBy: { shopName: "asc" } }),
    db.product.groupBy({ by: ["status"], _count: true }),
    db.category.findMany({ orderBy: { sortOrder: "asc" } }),
    db.product.findMany({ select: { brand: true }, distinct: ["brand"], orderBy: { brand: "asc" } }),
    db.product.findMany({ select: { productType: true }, distinct: ["productType"], orderBy: { productType: "asc" } }),
    db.product.findMany({ where, include: { variants: true, category: true, seller: { select: { shopName: true } } } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((s, c) => s + c._count, 0);

  let rows: Sortable[] = list.map((p) => {
    const tracked = p.variants.filter((v) => v.trackInventory);
    const stock = tracked.reduce((s, v) => s + v.stock, 0);
    const prices = p.variants.map((v) => v.price);
    return {
      id: p.id, name: p.name, image: p.image, status: p.status, brand: p.brand, category: p.category.name, type: p.productType,
      stock, variants: p.variants.length, tracked: tracked.length > 0, low: tracked.some((v) => v.stock > 0 && v.stock <= 3),
      priceFrom: prices.length ? Math.min(...prices) : 0, priceTo: prices.length ? Math.max(...prices) : 0,
      seller: p.seller?.shopName ?? null, approval: p.approvalStatus,
      created: +p.createdAt, updated: +p.updatedAt,
    };
  });
  if (sp.stock === "out") rows = rows.filter((r) => r.tracked && r.stock <= 0);
  if (sp.stock === "low") rows = rows.filter((r) => r.low);
  if (sp.stock === "in") rows = rows.filter((r) => !r.tracked || r.stock > 0);

  const sorters: Record<string, (a: Sortable, b: Sortable) => number> = {
    "title-asc": (a, b) => a.name.localeCompare(b.name),
    "title-desc": (a, b) => b.name.localeCompare(a.name),
    "created-desc": (a, b) => b.created - a.created,
    "created-asc": (a, b) => a.created - b.created,
    "updated-desc": (a, b) => b.updated - a.updated,
    "inventory-asc": (a, b) => a.stock - b.stock,
    "inventory-desc": (a, b) => b.stock - a.stock,
    "price-asc": (a, b) => a.priceFrom - b.priceFrom,
    "price-desc": (a, b) => b.priceFrom - a.priceFrom,
  };
  const sort = sp.sort && sorters[sp.sort] ? sp.sort : "updated-desc";
  rows.sort(sorters[sort]);
  const pageRows: ProductRow[] = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ created: _c, updated: _u, ...r }) => r);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, String(v));
    const s = p.toString();
    return `/admin/products${s ? `?${s}` : ""}`;
  };
  const exportHref = `/api/admin/products/export?format=xlsx${status ? `&status=${status}` : ""}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;

  return (
    <>
      <PageHeader
        title="Products"
        actions={
          <>
            <a className="btn-a" href={exportHref}>Export</a>
            <Link className="btn-a" href="/admin/products/import">Import</Link>
            <Link className="btn-a-primary" href="/admin/products/new">Add product</Link>
          </>
        }
      />
      <Card pad={false}>
        <Tabs
          current={status || "ALL"}
          tabs={[
            { key: "ALL", label: "All", href: qs({ status: "", page: "" }), count: total },
            { key: "ACTIVE", label: "Active", href: qs({ status: "ACTIVE", page: "" }), count: count("ACTIVE") },
            { key: "DRAFT", label: "Draft", href: qs({ status: "DRAFT", page: "" }), count: count("DRAFT") },
            { key: "ARCHIVED", label: "Archived", href: qs({ status: "ARCHIVED", page: "" }), count: count("ARCHIVED") },
          ]}
        />
        <form className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={sp.q} placeholder="Search title, vendor, SKU or tag" className="in-a min-w-56 flex-1" />
          <AutoSubmitSelect name="category" defaultValue={sp.category ?? ""} className="in-a w-auto">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="vendor" defaultValue={sp.vendor ?? ""} className="in-a w-auto">
            <option value="">All vendors</option>
            {vendors.map((v) => <option key={v.brand}>{v.brand}</option>)}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="type" defaultValue={sp.type ?? ""} className="in-a w-auto">
            <option value="">All types</option>
            {types.filter((t) => t.productType).map((t) => <option key={t.productType}>{t.productType}</option>)}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="seller" defaultValue={sp.seller ?? ""} className="in-a w-auto">
            <option value="">All sellers</option>
            <option value="store">Store (own stock)</option>
            <option value="marketplace">All marketplace sellers</option>
            {sellers.map((x) => <option key={x.id} value={x.id}>{x.shopName}</option>)}
          </AutoSubmitSelect>
          <AutoSubmitSelect name="approval" defaultValue={sp.approval ?? ""} className="in-a w-auto">
            <option value="">Any approval</option>
            <option value="PENDING">Awaiting approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </AutoSubmitSelect>
          <AutoSubmitSelect name="stock" defaultValue={sp.stock ?? ""} className="in-a w-auto">
            <option value="">Any stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock (≤3)</option>
            <option value="out">Out of stock</option>
          </AutoSubmitSelect>
          <AutoSubmitSelect name="sort" defaultValue={sort} className="in-a w-auto">
            <option value="updated-desc">Recently updated</option>
            <option value="created-desc">Newest</option>
            <option value="created-asc">Oldest</option>
            <option value="title-asc">Title A–Z</option>
            <option value="title-desc">Title Z–A</option>
            <option value="inventory-asc">Inventory: low to high</option>
            <option value="inventory-desc">Inventory: high to low</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </AutoSubmitSelect>
          <button className="btn-a">Search</button>
          {(sp.q || sp.category || sp.vendor || sp.type || sp.stock || sp.seller || sp.approval) && (
            <Link href={qs({ q: "", category: "", vendor: "", type: "", stock: "", seller: "", approval: "", page: "" })} className="btn-a">Clear</Link>
          )}
        </form>
        {pageRows.length ? (
          <ProductsTable rows={pageRows} />
        ) : (
          <EmptyState title="No products found" description="Try changing the filters or add a new product." action={<Link className="btn-a-primary" href="/admin/products/new">Add product</Link>} />
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} makeHref={(p) => qs({ page: String(p) })} />
      </Card>
    </>
  );
}
