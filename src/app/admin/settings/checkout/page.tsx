import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Field, PageHeader } from "@/components/admin/ui";
import FormShell from "@/components/admin/store/FormShell";
import { Grid, Toggle } from "@/components/admin/store/inputs";
import { saveCheckout } from "@/app/actions/admin/settings";

export const metadata = { title: "Checkout & payments" };

export default async function CheckoutSettings() {
  await requirePermission("settings");
  const s = await getSettings();
  const c = s.checkout;
  const stripe = !!process.env.STRIPE_SECRET_KEY, webhook = !!process.env.STRIPE_WEBHOOK_SECRET;
  return (
    <div>
      <PageHeader title="Checkout & payments" back="/admin/settings" />
      <FormShell action={saveCheckout}>
        <Card title="Payment providers">
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 p-4">
              <div>
                <p className="font-semibold">Stripe: cards, Apple Pay, Google Pay (AED)</p>
                <p className="mt-1 text-sm text-slate-500">
                  {stripe ? "Connected through STRIPE_SECRET_KEY." : "Not connected. Checkout uses the built-in demo card gateway (no real charges)."}
                </p>
                {(!stripe || !webhook) && (
                  <ol className="mt-2 list-decimal ps-5 text-xs text-slate-600">
                    {!stripe && <li>Create a Stripe account (UAE businesses supported), then copy your secret key into the <code>STRIPE_SECRET_KEY</code> environment variable.</li>}
                    {!webhook && <li>Add a webhook endpoint <code>/api/stripe/webhook</code> for <code>checkout.session.completed</code> and <code>checkout.session.expired</code>, then set <code>STRIPE_WEBHOOK_SECRET</code>.</li>}
                    <li>Restart the server.</li>
                  </ol>
                )}
              </div>
              <div className="flex gap-2"><Badge tone={stripe ? "green" : "yellow"}>{stripe ? "Live keys set" : "Demo mode"}</Badge><Badge tone={webhook ? "green" : "gray"}>{webhook ? "Webhook ✓" : "No webhook"}</Badge></div>
            </div>
            <Toggle name="cardEnabled" label="Accept card payments" defaultChecked={c.cardEnabled} />
            <Toggle name="codEnabled" label="Cash / card on delivery (COD)" help="Very popular in the UAE. Collected by your courier." defaultChecked={c.codEnabled} />
            <Grid>
              <Field label="COD fee (AED)"><input name="codFee" type="number" step="0.01" min={0} defaultValue={c.codFee} className="in-a" /></Field>
              <Field label="Maximum order value for COD (AED)"><input name="codMax" type="number" step="1" min={0} defaultValue={c.codMax} className="in-a" /></Field>
            </Grid>
            <Toggle name="bnplMessage" label="Show “Pay in 4” instalment messaging" help="Tabby and Tamara need merchant accounts. This toggle only shows the messaging on products and at checkout." defaultChecked={c.bnplMessage} />
          </div>
        </Card>
        <Card title="Checkout">
          <Toggle name="guestCheckout" label="Allow guest checkout" help="When off, customers must create an account before paying." defaultChecked={c.guestCheckout} />
          <Toggle name="orderNotes" label="Show delivery notes field" defaultChecked={c.orderNotes} />
          <Toggle name="marketingOptIn" label="Show email marketing opt-in at checkout" defaultChecked={c.marketingOptIn} />
        </Card>
        <Card title="Express delivery countdown">
          <Toggle name="showCountdown" label="Show “Order within Xh to get it by …” on Express products" help="Only turn this on if you really can deliver the next working day. Express products are chosen per product." defaultChecked={s.express.showCountdown} />
          <Grid>
            <Field label="Daily order cutoff (hour, UAE time, 0–23)"><input name="cutoffHour" type="number" min={0} max={23} defaultValue={s.express.cutoffHour} className="in-a" /></Field>
            <Field label="No deliveries on">
              <div className="flex flex-wrap gap-3 pt-1 text-sm">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                  <label key={d} className="flex items-center gap-1.5"><input type="checkbox" name="noDeliveryWeekdays" value={i} defaultChecked={s.express.noDeliveryWeekdays.includes(i)} /> {d}</label>
                ))}
              </div>
            </Field>
          </Grid>
        </Card>
        <Card title="Warranty, Care+ and returns">
          <Grid>
            <Field label="Standard warranty (months)"><input name="warrantyMonths" type="number" min={0} defaultValue={s.warranty.months} className="in-a" /></Field>
            <Field label="Return window (days)"><input name="returnsDays" type="number" min={0} defaultValue={s.returnsDays} className="in-a" /></Field>
            <Field label="Care+ price (% of item price)"><input name="carePlusPercent" type="number" step="0.1" min={0} defaultValue={s.warranty.carePlusPercent} className="in-a" /></Field>
            <Field label="Care+ minimum price (AED)"><input name="carePlusMin" type="number" min={0} defaultValue={s.warranty.carePlusMin} className="in-a" /></Field>
            <Field label="Care+ total coverage (months)"><input name="carePlusMonths" type="number" min={0} defaultValue={s.warranty.carePlusMonths} className="in-a" /></Field>
          </Grid>
        </Card>
      </FormShell>
    </div>
  );
}
