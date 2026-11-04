import { requirePermission } from "@/lib/auth";
import { RULE_FIELDS, RULE_OPS } from "@/lib/collections";
import { PageHeader } from "@/components/admin/ui";
import CollectionEditor from "@/components/admin/products/CollectionEditor";
import { pickerProducts } from "../_data";

export const metadata = { title: "Create collection" };

export default async function NewCollection() {
  await requirePermission("products");
  return (
    <>
      <PageHeader title="Create collection" back="/admin/collections" />
      <CollectionEditor
        products={await pickerProducts()} fields={RULE_FIELDS} ops={RULE_OPS}
        initial={{ title: "", titleAr: "", description: "", descriptionAr: "", handle: "", image: "", type: "MANUAL", rules: [{ field: "tag", op: "eq", value: "" }], disjunctive: false, sortOrder: "MANUAL", published: true, showOnHome: false, seoTitle: "", seoDescription: "", productIds: [] }}
      />
    </>
  );
}
