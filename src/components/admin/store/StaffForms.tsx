import type { User } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { Field } from "@/components/admin/ui";
import FormShell from "./FormShell";
import { addStaff, updateStaff } from "@/app/actions/admin/staff";

function PermissionBoxes({ selected = [] }: { selected?: string[] }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700">Permissions (staff accounts)</legend>
      <div className="grid gap-1 sm:grid-cols-2">
        {Object.entries(PERMISSIONS).map(([k, label]) => (
          <label key={k} className="flex items-start gap-2 text-sm"><input type="checkbox" name="permissions" value={k} defaultChecked={selected.includes(k)} className="mt-0.5 accent-slate-900" /><span><b className="capitalize">{k}</b>: <span className="text-slate-500">{label}</span></span></label>
        ))}
      </div>
    </fieldset>
  );
}

export function AddStaffForm({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  return (
    <FormShell action={addStaff} submitLabel="Add staff" resetOnOk>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input name="name" required className="in-a" /></Field>
        <Field label="Email"><input name="email" type="email" required className="in-a" /></Field>
        <Field label="Password" help="Leave blank to email them a link to set their own password"><input name="password" type="password" minLength={8} autoComplete="new-password" className="in-a" /></Field>
        <Field label="Role">
          <select name="role" className="in-a">
            <option value="STAFF">Staff: limited permissions</option>
            {canGrantAdmin && <option value="ADMIN">Admin: full access</option>}
          </select>
        </Field>
      </div>
      <PermissionBoxes selected={["orders"]} />
    </FormShell>
  );
}

export function EditStaffForm({ u, canGrantAdmin }: { u: User; canGrantAdmin: boolean }) {
  return (
    <FormShell action={updateStaff} submitLabel="Save permissions">
      <input type="hidden" name="id" value={u.id} />
      <Field label="Role" className="max-w-xs">
        <select name="role" defaultValue={u.role} className="in-a">
          <option value="STAFF">Staff</option>
          {(canGrantAdmin || u.role === "ADMIN") && <option value="ADMIN">Admin (full access)</option>}
        </select>
      </Field>
      <PermissionBoxes selected={u.permissions.split(",")} />
    </FormShell>
  );
}
