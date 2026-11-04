import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import ProductEditor from "@/components/admin/products/ProductEditor";
import { editorLookups, emptyProduct, storeHost } from "../_data";

export const metadata = { title: "Add product" };

export default async function NewProductPage() {
  await requirePermission("products");
  const { categories, collections } = await editorLookups();
  return (
    <>
      <PageHeader title="Add product" back="/admin/products" />
      <ProductEditor initial={emptyProduct()} categories={categories} collections={collections} storeHost={storeHost()} />
    </>
  );
}
