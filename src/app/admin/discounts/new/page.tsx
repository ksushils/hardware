import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import DiscountForm from "@/components/admin/sales/DiscountForm";
import { discountOptions, toInitial } from "@/components/admin/sales/discountData";

export const metadata = { title: "Create discount" };

export default async function NewDiscount() {
  await requirePermission("discounts");
  const opts = await discountOptions();
  return (
    <>
      <PageHeader back="/admin/discounts" title="Create discount" />
      <DiscountForm initial={toInitial()} products={opts.products} collections={opts.collections} />
    </>
  );
}
