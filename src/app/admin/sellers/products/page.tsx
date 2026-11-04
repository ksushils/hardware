import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, StatusBadge, Tabs } from "@/components/admin/ui";
import Flash from "@/components/marketplace/Flash";
import { parseSpecs } from "@/lib/format";
import { CONDITION_TYPE_LABEL, WARRANTY_PROVIDER_LABEL, effectiveCondition, parsePhotos } from "@/lib/offers";
import { reviewProducts } from "@/app/actions/admin/sellers";
import { reviewOffers, setOfferVerification } from "@/app/actions/admin/offers";

export const metadata = { title: "Marketplace approvals" };
const STATUSES = ["PENDING", "APPROVED", "REJECTED", "DRAFT"];

export default async function Approvals({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string; msg?: string; error?: string }> }) {
  await requirePermission("sellers");
  const sp = await searchParams;
  const kind = sp.kind === "products" ? "products" : "offers";
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "PENDING";
  const ret = `/admin/sellers/products?kind=${kind}&status=${status}`;
  const [offerCounts, productCounts] = await Promise.all([
    db.variant.groupBy({ by: ["approvalStatus"], where: { sellerId: { not: null }, product: { approvalStatus: "APPROVED" } }, _count: true }),
    db.product.groupBy({ by: ["approvalStatus"], where: { sellerId: { not: null } }, _count: true }),
  ]);
  const counts = kind === "offers" ? offerCounts : productCounts;
  const c = (st: string) => counts.find((x) => x.approvalStatus === st)?._count ?? 0;
  const total = (arr: typeof offerCounts, st: string) => arr.find((x) => x.approvalStatus === st)?._count ?? 0;

  return (
    <>
      <PageHeader back="/admin/sellers" title="Marketplace approvals"
        subtitle="Offers are what buyers actually purchase: price, condition, evidence, warranty and returns from one seller. New products are the shared product pages sellers propose." />
      <Flash msg={sp.msg} error={sp.error} />
      <div className="mb-3 flex gap-2">
        <Link href="/admin/sellers/products?kind=offers" className={kind === "offers" ? "btn-a-primary" : "btn-a"}>Seller offers {total(offerCounts, "PENDING") > 0 && <Badge tone="yellow">{total(offerCounts, "PENDING")}</Badge>}</Link>
        <Link href="/admin/sellers/products?kind=products" className={kind === "products" ? "btn-a-primary" : "btn-a"}>New products {total(productCounts, "PENDING") > 0 && <Badge tone="yellow">{total(productCounts, "PENDING")}</Badge>}</Link>
      </div>
      <Card pad={false}>
        <Tabs current={status} tabs={(kind === "offers" ? ["PENDING", "APPROVED", "REJECTED"] : STATUSES).map((st) => ({ key: st, label: st === "PENDING" ? "Awaiting review" : st.charAt(0) + st.slice(1).toLowerCase(), href: `/admin/sellers/products?kind=${kind}&status=${st}`, count: c(st) }))} />
        {kind === "offers" ? <Offers status={status} ret={ret} /> : <NewProducts status={status} ret={ret} />}
      </Card>
    </>
  );
}

async function Offers({ status, ret }: { status: string; ret: string }) {
  const offers = await db.variant.findMany({
    where: { sellerId: { not: null }, approvalStatus: status, product: { approvalStatus: "APPROVED" } },
    include: { seller: true, product: { include: { images: { orderBy: { position: "asc" }, take: 1 }, options: { orderBy: { position: "asc" } }, category: true } } },
    orderBy: { id: "asc" },
  });
  if (!offers.length) return <EmptyState title="Nothing here" description={status === "PENDING" ? "No seller offers are waiting for review." : "No offers with this status."} />;
  return (
    <div>
      <form id="bulk" action={reviewOffers}><input type="hidden" name="return" value={ret} /></form>
      <div className="divide-y divide-slate-100">
        {offers.map((v) => {
          const ci = v.product.options.findIndex((o) => o.name.toLowerCase() === "condition");
          const cond = effectiveCondition(v, ci >= 0 ? v[(["option1", "option2", "option3"] as const)[ci]] : null);
          const photos = parsePhotos(v);
          const F = ({ l, x }: { l: string; x: React.ReactNode }) => <div className="flex gap-2 py-0.5"><dt className="w-36 shrink-0 text-slate-500">{l}</dt><dd className={x ? "" : "text-slate-400"}>{x || "Not supplied"}</dd></div>;
          return (
            <div key={v.id} className="flex gap-3 p-4 text-sm">
              <input form="bulk" type="checkbox" name="ids" value={v.id} className="mt-1" aria-label={`Select ${v.product.name}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.product.images[0] && <img src={v.product.images[0].url} alt="" className="h-12 w-12 rounded-lg border bg-slate-50 object-contain" />}
                  <div>
                    <p className="font-semibold"><Link href={`/admin/products/${v.productId}`} className="hover:underline">{v.product.brand} {v.product.name}</Link> · {v.title === "Default Title" ? "Default" : v.title} <StatusBadge status={v.approvalStatus} /></p>
                    <p className="text-xs text-slate-500">🏪 <Link href={`/admin/sellers/${v.sellerId}`} className="hover:underline">{v.seller?.shopName}</Link> · AED {v.price} · {v.stock} in stock · SKU {v.sku ?? "—"}</p>
                  </div>
                </div>
                <details className="mt-2 rounded-lg border border-slate-200 p-3" open={status === "PENDING"}>
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600">Full condition, evidence & terms</summary>
                  <dl className="mt-2 text-xs">
                    <F l="Commercial condition" x={cond.type ? CONDITION_TYPE_LABEL[cond.type][0] : null} />
                    <F l="Cosmetic grade" x={cond.grade} />
                    <F l="Functional status" x={v.functionalStatus} />
                    <F l="Battery" x={v.batteryHealth != null ? `${v.batteryHealth}%${v.batteryCycles != null ? ` · ${v.batteryCycles} cycles` : ""}` : null} />
                    <F l="Repairs / parts" x={v.repairDisclosure} />
                    <F l="Accessories" x={v.accessories} />
                    <F l="Tested" x={v.testedAt || v.testedBy || v.testNotes ? [v.testedAt?.toLocaleDateString("en-AE"), v.testedBy && `by ${v.testedBy}`, v.testNotes].filter(Boolean).join(" · ") : null} />
                    <F l="Warranty" x={v.warrantyProvider || v.warrantyMonths != null ? `${v.warrantyMonths ?? "—"} months · ${v.warrantyProvider ? WARRANTY_PROVIDER_LABEL[v.warrantyProvider][0] : "provider not stated"}${v.warrantyTerms ? ` — ${v.warrantyTerms}` : ""}` : null} />
                    <F l="Returns" x={v.returnDays != null || v.returnTerms ? `${v.returnDays ?? "standard"} days${v.returnTerms ? ` — ${v.returnTerms}` : ""}` : null} />
                    <F l="Dispatch" x={`${v.handlingDays} business day(s)`} />
                    <F l="Verification" x={<Badge tone={v.verification === "PLATFORM_VERIFIED" ? "green" : v.verification === "SELLER_DECLARED" ? "blue" : "gray"}>{v.verification.replace("_", " ").toLowerCase()}</Badge>} />
                  </dl>
                  {photos.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{/* eslint-disable-next-line @next/next/no-img-element */}{photos.map((u) => <img key={u} src={u} alt="" className="h-16 w-16 rounded-lg border object-cover" />)}</div>}
                  {v.rejectionReason && <p className="mt-2 text-xs text-red-600">Rejected: {v.rejectionReason}</p>}
                </details>
                <form action={setOfferVerification} className="mt-2 flex flex-wrap items-end gap-2 text-xs">
                  <input type="hidden" name="id" value={v.id} /><input type="hidden" name="return" value={ret} />
                  <label>Evidence level<select name="verification" defaultValue={v.verification} className="in-a block py-1"><option value="NONE">None</option><option value="SELLER_DECLARED">Seller-declared</option><option value="PLATFORM_VERIFIED">Verified by TechRevive</option></select></label>
                  <label>Verified by<input name="testedBy" defaultValue={v.testedBy ?? ""} placeholder="Tester / lab" className="in-a block w-40 py-1" /></label>
                  <label>Date<input name="testedAt" type="date" defaultValue={v.testedAt ? v.testedAt.toISOString().slice(0, 10) : ""} className="in-a block py-1" /></label>
                  <button className="btn-a">Save evidence level</button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-white p-3">
        <button form="bulk" name="decision" value="APPROVED" className="btn-a-primary">Approve selected</button>
        <input form="bulk" name="reason" placeholder="Reason (required to reject)" className="in-a w-72" />
        <button form="bulk" name="decision" value="REJECTED" className="btn-a-danger">Reject selected</button>
      </div>
    </div>
  );
}

async function NewProducts({ status, ret }: { status: string; ret: string }) {
  const products = await db.product.findMany({ where: { sellerId: { not: null }, approvalStatus: status }, include: { seller: true, variants: true, category: true, images: { orderBy: { position: "asc" } } }, orderBy: { updatedAt: "asc" } });
  if (!products.length) return <EmptyState title="Nothing here" description={status === "PENDING" ? "No new seller products are waiting for review." : "No products with this status."} />;
  return (
    <form action={reviewProducts}>
      <input type="hidden" name="return" value={ret} />
      <div className="divide-y divide-slate-100">
        {products.map((p) => {
          const specs = parseSpecs(p.specs);
          return (
            <div key={p.id} className="flex gap-4 p-4">
              <input type="checkbox" name="ids" value={p.id} className="mt-1" aria-label={`Select ${p.name}`} />
              <div className="flex gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.images.slice(0, 3).map((im) => <img key={im.id} src={im.url} alt="" className="h-16 w-16 rounded-lg border bg-slate-50 object-contain" />)}
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold"><Link href={`/admin/products/${p.id}`} className="hover:underline">{p.brand} {p.name}</Link> <StatusBadge status={p.approvalStatus} /></p>
                <p className="text-xs text-slate-500">🏪 <Link href={`/admin/sellers/${p.sellerId}`} className="hover:underline">{p.seller?.shopName}</Link> · {p.category.name} · updated {p.updatedAt.toLocaleString("en-AE")}</p>
                <p className="mt-1 line-clamp-2 text-slate-600">{p.description}</p>
                <p className="mt-1 text-xs text-slate-500">{Object.entries(specs).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                <table className="mt-2 text-xs"><tbody>{p.variants.filter((v) => v.sellerId === p.sellerId).map((v) => <tr key={v.id}><td className="pe-4">{v.title}</td><td className="pe-4">AED {v.price}{p.priceNew ? ` (new AED ${p.priceNew})` : ""}</td><td className="pe-4">{v.stock} in stock</td><td className="text-slate-500">{v.conditionType ?? "—"}</td></tr>)}</tbody></table>
                {p.rejectionReason && <p className="mt-1 text-xs text-red-600">Rejected: {p.rejectionReason}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-4 pb-2 text-xs text-slate-500">Approving a new product also approves the proposing seller&apos;s offers on it.</p>
      <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-white p-3">
        <button name="decision" value="APPROVED" className="btn-a-primary">Approve selected</button>
        <input name="reason" placeholder="Reason (required to reject)" className="in-a w-72" />
        <button name="decision" value="REJECTED" className="btn-a-danger">Reject selected</button>
      </div>
    </form>
  );
}
