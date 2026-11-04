import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { parseSpecs, parseValues } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import SellerProductForm from "@/components/marketplace/SellerProductForm";
import { getSettings } from "@/lib/settings";
import { parsePhotos } from "@/lib/offers";

export const metadata = { title: "Edit product" };

export default async function EditSellerProduct({ params }: { params: Promise<{ id: string }> }) {
  const { seller } = await requireSeller();
  const { id } = await params;
  const p = await db.product.findFirst({ where: { id, sellerId: seller.id }, include: { variants: { orderBy: { position: "asc" } }, options: { orderBy: { position: "asc" } }, images: { orderBy: { position: "asc" } } } });
  if (!p) notFound();
  const settings = await getSettings();
  const own = p.variants.filter((v) => v.sellerId === seller.id);
  const first = own[0];
  const n = (x: number | null | undefined) => (x == null ? "" : String(x));
  const locked = p.approvalStatus === "APPROVED" && p.variants.some((v) => v.sellerId !== seller.id);
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  const isDefault = p.options.length === 1 && p.options[0].name === "Title";
  return (
    <>
      <PageHeader back="/seller/products" title={<span className="flex items-center gap-2">{p.name} <StatusBadge status={p.approvalStatus} /></span>} />
      <SellerProductForm categories={categories} locked={locked} minReturnDays={settings.returnsDays} terms={{
        conditionType: first?.conditionType ?? "REFURBISHED", cosmeticGrade: first?.cosmeticGrade ?? "", functionalStatus: first?.functionalStatus ?? "", batteryHealth: n(first?.batteryHealth), batteryCycles: n(first?.batteryCycles),
        repairDisclosure: first?.repairDisclosure ?? "", accessories: first?.accessories ?? "", testedAt: first?.testedAt ? first.testedAt.toISOString().slice(0, 10) : "", testedBy: first?.testedBy ?? "", testNotes: first?.testNotes ?? "",
        warrantyProvider: first?.warrantyProvider ?? "SELLER", warrantyMonths: first ? n(first.warrantyMonths) : "12", warrantyTerms: first?.warrantyTerms ?? "", returnDays: n(first?.returnDays), returnTerms: first?.returnTerms ?? "",
        handlingDays: String(first?.handlingDays ?? 1), photos: first ? parsePhotos(first) : [], declared: !!first && first.verification !== "NONE", verification: first?.verification,
      }} initial={{
        id: p.id, name: p.name, nameAr: p.nameAr, description: p.description, descriptionAr: p.descriptionAr, categoryId: p.categoryId, brand: p.brand, productType: p.productType,
        priceNew: p.priceNew, tags: p.tags, specs: parseSpecs(p.specs), images: p.images.length ? p.images.map((i) => i.url) : p.image ? [p.image] : [],
        options: isDefault ? [] : p.options.map((o) => ({ name: o.name, nameAr: o.nameAr, values: parseValues(o.values) })),
        variants: own.map((v) => ({ option1: isDefault ? null : v.option1, option2: v.option2, option3: v.option3, price: v.price, comparePrice: v.comparePrice, stock: v.stock, sku: v.sku ?? "" })),
        approvalStatus: p.approvalStatus, rejectionReason: p.rejectionReason,
      }} />
    </>
  );
}
