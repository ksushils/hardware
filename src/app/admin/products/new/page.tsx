import { db } from "@/lib/db";
import ProductForm from "@/components/admin/ProductForm";
export default async function NewProduct() {
  const categories = await db.category.findMany({ orderBy: { sortOrder: "asc" } });
  return <><h2 className="mb-4 text-xl font-bold">New product</h2><ProductForm categories={categories} /></>;
}
