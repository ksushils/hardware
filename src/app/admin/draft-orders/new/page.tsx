import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import DraftForm from "@/components/admin/sales/DraftForm";
import { draftContext, emptyDraft } from "@/components/admin/sales/draftData";

export const metadata = { title: "Create order" };

export default async function NewDraft({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  await requirePermission("orders");
  const { customer } = await searchParams;
  const ctx = await draftContext();
  let initial = emptyDraft;
  if (customer) {
    const u = await db.user.findUnique({ where: { id: customer }, include: { addresses: { orderBy: { isDefault: "desc" }, take: 1 } } });
    if (u) {
      const a = u.addresses[0];
      initial = { ...emptyDraft, email: u.email, fullName: a?.fullName ?? u.name, phone: a?.phone ?? u.phone ?? "", ...(a ? { emirate: a.emirate, area: a.area, street: a.street, building: a.building } : {}) };
    }
  }
  return (
    <>
      <PageHeader back="/admin/draft-orders" title="Create order" />
      <DraftForm initial={initial} rates={ctx.rates} cfg={ctx.cfg} />
    </>
  );
}
