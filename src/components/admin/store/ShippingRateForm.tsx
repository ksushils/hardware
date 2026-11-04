import type { ShippingRate } from "@prisma/client";
import { EMIRATES } from "@/lib/format";
import { Field } from "@/components/admin/ui";
import FormShell from "./FormShell";
import { Toggle } from "./inputs";
import { saveShippingRate } from "@/app/actions/admin/settings";

export default function ShippingRateForm({ rate }: { rate?: ShippingRate }) {
  const sel = rate?.emirates ? rate.emirates.split(",") : EMIRATES;
  return (
    <FormShell action={saveShippingRate} submitLabel={rate ? "Save rate" : "Add rate"} resetOnOk={!rate}>
      {rate && <input type="hidden" name="id" value={rate.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input name="name" required defaultValue={rate?.name} placeholder="Standard delivery" className="in-a" /></Field>
        <Field label="Name (Arabic)"><input name="nameAr" dir="rtl" defaultValue={rate?.nameAr} className="in-a" /></Field>
        <Field label="Price (AED)"><input name="price" type="number" step="0.01" min={0} required defaultValue={rate?.price} className="in-a" /></Field>
        <Field label="Free when order is at least (AED)" help="Leave blank for never free"><input name="freeAbove" type="number" step="0.01" min={0} defaultValue={rate?.freeAbove ?? ""} className="in-a" /></Field>
        <Field label="Minimum order (AED)"><input name="minOrder" type="number" step="0.01" min={0} defaultValue={rate?.minOrder ?? 0} className="in-a" /></Field>
        <Field label="Maximum order (AED)" help="Blank = no maximum"><input name="maxOrder" type="number" step="0.01" min={0} defaultValue={rate?.maxOrder ?? ""} className="in-a" /></Field>
        <Field label="Delivery time (days)" help='e.g. "2-4", "1", or "0" for same day'><input name="deliveryDays" defaultValue={rate?.deliveryDays ?? "2-4"} className="in-a" /></Field>
        <Field label="Sort position"><input name="position" type="number" defaultValue={rate?.position ?? 0} className="in-a" /></Field>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-slate-700">Emirates</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {EMIRATES.map((e) => (
            <label key={e} className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="emirates" value={e} defaultChecked={sel.includes(e)} className="accent-slate-900" />{e}</label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-x-6">
        <Toggle name="expressOnly" label="Express only" help="Only offered when every item is express-eligible" defaultChecked={rate?.expressOnly} />
        <Toggle name="active" label="Active" defaultChecked={rate?.active ?? true} />
      </div>
    </FormShell>
  );
}
