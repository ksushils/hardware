import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Field, PageHeader, Pagination, th, td } from "@/components/admin/ui";
import FormShell from "@/components/admin/store/FormShell";
import { Toggle } from "@/components/admin/store/inputs";
import { saveNotifications } from "@/app/actions/admin/settings";

export const metadata = { title: "Notifications" };
const PAGE = 25;
const LABELS: Record<string, [string, string]> = {
  orderConfirmation: ["Order confirmation", "Sent when an order is placed or paid"],
  shippingConfirmation: ["Shipping confirmation", "Sent when you fulfil an order, with tracking"],
  deliveryConfirmation: ["Delivery confirmation", "Sent when an order is marked delivered"],
  refundNotification: ["Refund notification", "Sent when you issue a refund"],
  abandonedCart: ["Abandoned checkout recovery", "Lets you email shoppers who didn't complete checkout"],
  backInStock: ["Back in stock", "Emails shoppers who asked to be notified when a variant is restocked"],
  staffOrderAlert: ["New order alert to staff", "Sent to the staff email below for every new order"],
};

export default async function NotificationSettings({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  await requirePermission("settings");
  const s = await getSettings();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.status ? { status: sp.status } : {};
  const [logs, total] = await Promise.all([
    db.emailLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, to: true, subject: true, template: true, status: true, createdAt: true } }),
    db.emailLog.count({ where }),
  ]);
  const provider = !!process.env.RESEND_API_KEY;
  return (
    <div className="space-y-5">
      <PageHeader title="Notifications" back="/admin/settings" />
      <div className={`rounded-xl border px-4 py-3 text-sm ${provider ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {provider ? "Emails are delivered through Resend." : <>No email provider is connected, so emails are only <b>logged</b> below and not delivered. Set <code>RESEND_API_KEY</code> (and optionally <code>EMAIL_FROM</code>) to send them.</>}
      </div>
      <FormShell action={saveNotifications}>
        <Card title="Customer & staff notifications">
          <div className="divide-y divide-slate-100">
            {Object.entries(LABELS).map(([k, [l, h]]) => (
              <Toggle key={k} name={k} label={l} help={h} defaultChecked={Boolean(s.notifications[k as keyof typeof s.notifications])} />
            ))}
          </div>
          <Field label="Staff notification email" className="mt-4 max-w-md"><input name="staffEmail" type="email" defaultValue={s.notifications.staffEmail} className="in-a" /></Field>
        </Card>
      </FormShell>
      <Card title="Email log" pad={false} actions={
        <div className="flex gap-1 text-xs">
          {["", "SENT", "LOGGED", "FAILED"].map((st) => <Link key={st} href={`/admin/settings/notifications${st ? `?status=${st}` : ""}`} className={`rounded-md px-2 py-1 ${(sp.status ?? "") === st ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{st || "All"}</Link>)}
        </div>
      }>
        {logs.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No emails yet.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Date</th><th className={th}>To</th><th className={th}>Subject</th><th className={th}>Template</th><th className={th}>Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{l.createdAt.toLocaleString("en-AE", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className={td}>{l.to}</td>
                  <td className={td}><Link href={`/admin/settings/notifications/${l.id}`} className="font-medium hover:underline">{l.subject}</Link></td>
                  <td className={`${td} font-mono text-xs text-slate-500`}>{l.template}</td>
                  <td className={td}><Badge tone={l.status === "SENT" ? "green" : l.status === "FAILED" ? "red" : "gray"}>{l.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE} total={total} makeHref={(n) => `/admin/settings/notifications?page=${n}${sp.status ? `&status=${sp.status}` : ""}`} />
      </Card>
    </div>
  );
}
