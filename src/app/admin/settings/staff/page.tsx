import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/client";
import { AddStaffForm, EditStaffForm } from "@/components/admin/store/StaffForms";
import { removeStaff, resendInvite, toggleStaffDisabled } from "@/app/actions/admin/staff";

export const metadata = { title: "Staff & permissions" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const me = await requirePermission("staff");
  const { edit } = await searchParams;
  const staff = await db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] } }, orderBy: [{ role: "asc" }, { createdAt: "asc" }] });
  const canGrantAdmin = me.role === "ADMIN";
  return (
    <div className="space-y-5">
      <PageHeader title="Staff & permissions" back="/admin/settings" subtitle={`${staff.length} account(s) with admin access`} />
      <Card title="Staff accounts" pad={false}>
        <ul className="divide-y divide-slate-100">
          {staff.map((u) => (
            <li key={u.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-sm font-bold text-white">{u.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{u.name} {u.id === me.id && <span className="text-xs font-normal text-slate-500">(you)</span>}</p>
                  <p className="text-sm text-slate-500">{u.email}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {u.role === "ADMIN" ? <Badge tone="purple">Admin: full access</Badge> : u.permissions ? u.permissions.split(",").map((p) => <Badge key={p}>{p}</Badge>) : <Badge tone="yellow">No permissions</Badge>}
                    {u.disabled && <Badge tone="red">Disabled</Badge>}
                  </p>
                </div>
                {u.id !== me.id && (u.role !== "ADMIN" || canGrantAdmin) && (
                  <div className="flex flex-wrap gap-2">
                    <Link href={edit === u.id ? "/admin/settings/staff" : `/admin/settings/staff?edit=${u.id}`} className="btn-a">{edit === u.id ? "Close" : "Edit"}</Link>
                    <form action={resendInvite}><input type="hidden" name="id" value={u.id} /><button className="btn-a">Send reset link</button></form>
                    <form action={toggleStaffDisabled}><input type="hidden" name="id" value={u.id} /><button className="btn-a">{u.disabled ? "Enable" : "Disable"}</button></form>
                    <form action={removeStaff}><input type="hidden" name="id" value={u.id} /><ConfirmButton message={`Remove admin access for ${u.email}? Their customer account is kept.`}>Remove</ConfirmButton></form>
                  </div>
                )}
              </div>
              {edit === u.id && <div className="mt-4 rounded-lg bg-slate-50 p-4"><EditStaffForm u={u} canGrantAdmin={canGrantAdmin} /></div>}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Add staff"><AddStaffForm canGrantAdmin={canGrantAdmin} /></Card>
      <p className="text-xs text-slate-500">Staff sign in at /login with their own email. Admins have every permission. Staff only see the sections you allow.</p>
    </div>
  );
}
