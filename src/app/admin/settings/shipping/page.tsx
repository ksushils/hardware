import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { aed, EMIRATES } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import ShippingRateForm from "@/components/admin/store/ShippingRateForm";
import CarrierWindowForm from "@/components/admin/store/CarrierWindowForm";
import { getSettings } from "@/lib/settings";
import { deleteShippingRate } from "@/app/actions/admin/settings";

export const metadata = { title: "Shipping & delivery" };

export default async function ShippingSettings({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  await requirePermission("settings");
  const { edit } = await searchParams;
  const rates = await db.shippingRate.findMany({ orderBy: { position: "asc" } });
  const settings = await getSettings();
  return (
    <div className="space-y-5">
      <PageHeader title="Shipping & delivery" back="/admin/settings" subtitle="Rates shown at checkout, filtered by the customer's emirate and cart" />
      <Card title="Delivery rates" pad={false}>
        <ul className="divide-y divide-slate-100">
          {rates.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No rates. Customers can&apos;t check out until you add one.</li>}
          {rates.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.name} {!r.active && <Badge>Inactive</Badge>} {r.expressOnly && <Badge tone="purple">Express only</Badge>}</p>
                  <p className="text-sm text-slate-500">
                    {aed(r.price)}{r.freeAbove != null && ` · free over ${aed(r.freeAbove)}`} · {r.deliveryDays === "0" ? "same day" : `${r.deliveryDays} day(s)`} ·{" "}
                    {r.emirates ? r.emirates.split(",").join(", ") : `All ${EMIRATES.length} emirates`}
                    {r.minOrder > 0 && ` · min ${aed(r.minOrder)}`}{r.maxOrder != null && ` · max ${aed(r.maxOrder)}`}
                  </p>
                </div>
                <a href={edit === r.id ? "/admin/settings/shipping" : `/admin/settings/shipping?edit=${r.id}`} className="btn-a">{edit === r.id ? "Close" : "Edit"}</a>
                <form action={deleteShippingRate}><input type="hidden" name="id" value={r.id} /><ConfirmButton message={`Delete "${r.name}"?`}>Delete</ConfirmButton></form>
              </div>
              {edit === r.id && <div className="mt-4 rounded-lg bg-slate-50 p-4"><ShippingRateForm rate={r} /></div>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add delivery rate"><ShippingRateForm /></Card>
      <Card title="Seller-shipped parcels (marketplace)"><CarrierWindowForm min={settings.delivery.carrierMinDays} max={settings.delivery.carrierMaxDays} /></Card>
    </div>
  );
}
