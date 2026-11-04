import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Badge, PageHeader } from "@/components/admin/ui";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import DiscountForm from "@/components/admin/sales/DiscountForm";
import { discountOptions, toInitial } from "@/components/admin/sales/discountData";
import { Banner, discountStatus, type SP } from "@/components/admin/sales/queries";
import { deleteDiscount, duplicateDiscount } from "@/app/actions/admin/discounts";

export const metadata = { title: "Discount" };

export default async function EditDiscount({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requirePermission("discounts");
  const { id } = await params;
  const sp = await searchParams;
  const d = await db.discount.findUnique({ where: { id } });
  if (!d) notFound();
  const opts = await discountOptions();
  const st = discountStatus(d);
  const orders = await db.order.count({ where: { discountCode: d.code ?? d.title, status: { notIn: ["DRAFT", "CANCELLED"] } } });
  return (
    <>
      <PageHeader back="/admin/discounts" title={<span className="flex items-center gap-2">{d.code ?? d.title}<Badge tone={st.tone}>{st.label}</Badge></span>}
        subtitle={`${orders} order(s) used this discount`}
        actions={<>
          <form action={duplicateDiscount}><input type="hidden" name="id" value={d.id} /><SubmitButton className="btn-a">Duplicate</SubmitButton></form>
          <form action={deleteDiscount}><input type="hidden" name="id" value={d.id} /><ConfirmButton message="Delete this discount?">Delete</ConfirmButton></form>
        </>} />
      <Banner sp={sp} />
      <DiscountForm initial={toInitial(d)} products={opts.products} collections={opts.collections} />
    </>
  );
}
