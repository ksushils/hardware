"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { updateProfile } from "@/app/actions/account";

export default function ProfileForm({ name, email, phone }: { name: string; email: string; phone: string }) {
  const { state, pending, formProps } = useFormAction(updateProfile);
  return (
    <form {...formProps} className="card space-y-4 p-6">
      <h2 className="text-lg font-bold">Profile</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Full name</span><input name="name" defaultValue={name} className="input" /></label>
        <label><span className="label">Email</span><input value={email} disabled className="input bg-slate-100" /></label>
        <label><span className="label">Mobile</span><input name="phone" defaultValue={phone} className="input" /></label>
      </div>
      <h3 className="pt-2 font-semibold">Change password</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Current password</span><input name="currentPassword" type="password" className="input" autoComplete="current-password" /></label>
        <label><span className="label">New password</span><input name="newPassword" type="password" className="input" autoComplete="new-password" /></label>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saving..." : "Save changes"}</button>
    </form>
  );
}
