import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import ImportWizard from "@/components/admin/products/ImportWizard";

export const metadata = { title: "Import products" };

export default async function ImportPage() {
  await requirePermission("products");
  return (
    <>
      <PageHeader title="Import & export products" back="/admin/products" subtitle="Bulk create or update products and variants from Excel (.xlsx) or CSV." />
      <ImportWizard />
    </>
  );
}
