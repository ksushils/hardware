import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { getSettings } from "@/lib/settings";
import { parseValues } from "@/lib/format";
import { parsePhotos } from "@/lib/offers";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import OfferForm from "@/components/marketplace/OfferForm";

export const metadata = { title: "Edit offer" };

export default async function EditOffer({ params }: { params: Promise<{ id: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;
  const v = await db.variant.findFirst({ where: { id, sellerId: seller.id }, include: { product: { include: { options: { orderBy: { position: "asc" } } } } } });
  if (!v) notFound();
  const s = await getSettings();
  const p = v.product;
  const options = p.options.map((o) => ({ name: o.name, values: parseValues(o.values) }));
  const n = (x: number | null) => (x == null ? "" : String(x));
  return (
    <>
      <PageHeader back="/seller/products" title={<span className="flex items-center gap-2">{p.name} · {v.title === "Default Title" ? "Default" : v.title} <StatusBadge status={v.approvalStatus} /></span>} />
      <OfferForm product={{ id: p.id, name: `${p.brand} ${p.name}`, image: p.image }} options={options} priceNew={p.priceNew} minReturnDays={s.returnsDays}
        initial={{
          id: v.id, options: [v.option1, v.option2, v.option3].slice(0, options.length), sku: v.sku ?? "", price: String(v.price), stock: String(v.stock),
          approvalStatus: v.approvalStatus, rejectionReason: v.rejectionReason,
          terms: {
            conditionType: v.conditionType ?? "REFURBISHED", cosmeticGrade: v.cosmeticGrade ?? "", functionalStatus: v.functionalStatus ?? "", batteryHealth: n(v.batteryHealth), batteryCycles: n(v.batteryCycles),
            repairDisclosure: v.repairDisclosure ?? "", accessories: v.accessories ?? "", testedAt: v.testedAt ? v.testedAt.toISOString().slice(0, 10) : "", testedBy: v.testedBy ?? "", testNotes: v.testNotes ?? "",
            warrantyProvider: v.warrantyProvider ?? "SELLER", warrantyMonths: n(v.warrantyMonths), warrantyTerms: v.warrantyTerms ?? "", returnDays: n(v.returnDays), returnTerms: v.returnTerms ?? "",
            handlingDays: String(v.handlingDays), photos: parsePhotos(v), declared: v.verification !== "NONE", verification: v.verification,
          },
        }} />
    </>
  );
}
