import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { PageHeader } from "@/components/admin/ui";
import SellerProductForm from "@/components/marketplace/SellerProductForm";
import { blankTerms } from "@/lib/offerTermsInitial";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Add product" };

export default async function NewSellerProduct() {
  await requireSeller();
  const settings = await getSettings();
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader back="/seller/products" title="Create a new product" subtitle="Use this only if the product isn't in the catalogue yet. The marketplace team reviews new products. To sell something that already exists, add an offer to it instead." />
      <SellerProductForm categories={categories} terms={blankTerms()} minReturnDays={settings.returnsDays} initial={{ name: "", nameAr: "", description: "", descriptionAr: "", categoryId: "", brand: "", productType: "", priceNew: 0, tags: "", specs: {}, images: [], options: [], variants: [] }} />
    </>
  );
}
