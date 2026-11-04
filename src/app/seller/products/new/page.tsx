import { db } from "@/lib/db";
import { requireSeller } from "@/lib/sellerAuth";
import { PageHeader } from "@/components/admin/ui";
import SellerProductForm from "@/components/marketplace/SellerProductForm";

export const metadata = { title: "Add product" };

export default async function NewSellerProduct() {
  await requireSeller();
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader back="/seller/products" title="Add product" />
      <SellerProductForm categories={categories} initial={{ name: "", nameAr: "", description: "", descriptionAr: "", categoryId: "", brand: "", productType: "", priceNew: 0, tags: "", specs: {}, images: [], options: [], variants: [] }} />
    </>
  );
}
