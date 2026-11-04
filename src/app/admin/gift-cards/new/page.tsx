import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { NewGiftCardForm } from "@/components/admin/products/GiftCardForms";

export const metadata = { title: "Issue gift card" };

export default async function NewGiftCard() {
  await requirePermission("products");
  return (<><PageHeader title="Issue gift card" back="/admin/gift-cards" /><NewGiftCardForm /></>);
}
