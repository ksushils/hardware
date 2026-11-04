import { Field } from "@/components/admin/ui";
import FormShell from "./FormShell";
import { saveCarrierWindow } from "@/app/actions/admin/settings";

/** Courier transit window added to a seller's handling time to estimate delivery for seller-shipped parcels. */
export default function CarrierWindowForm({ min, max }: { min: number; max: number }) {
  return (
    <FormShell action={saveCarrierWindow} submitLabel="Save window">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Courier transit, minimum (business days)"><input name="carrierMinDays" type="number" min={0} max={30} defaultValue={min} className="in-a" /></Field>
        <Field label="Courier transit, maximum (business days)"><input name="carrierMaxDays" type="number" min={0} max={30} defaultValue={max} className="in-a" /></Field>
      </div>
      <p className="text-xs text-slate-500">Estimated delivery for a seller&apos;s shipment = the slowest item&apos;s handling days + this window. Example: handling 2 days with a 1–3 day window shows &ldquo;3–5 business days&rdquo;.</p>
    </FormShell>
  );
}
