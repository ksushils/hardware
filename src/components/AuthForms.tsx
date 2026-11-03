"use client";
import { useFormAction } from "@/hooks/useFormAction";
import Link from "next/link";
import { login, register } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useFormAction(login);
  return (
    <form {...formProps} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
      <label className="block"><span className="label">Password</span><input name="password" type="password" required className="input" autoComplete="current-password" /></label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
      <p className="text-center text-sm">New to TechRevive? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 underline">Create an account</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const { state, pending, formProps } = useFormAction(register);
  return (
    <form {...formProps} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block"><span className="label">Full name</span><input name="name" required className="input" autoComplete="name" /></label>
      <label className="block"><span className="label">Email</span><input name="email" type="email" required className="input" autoComplete="email" /></label>
      <label className="block"><span className="label">Mobile (optional)</span><input name="phone" placeholder="05X XXX XXXX" className="input" autoComplete="tel" /></label>
      <label className="block"><span className="label">Password</span><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></label>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Creating account..." : "Create account"}</button>
      <p className="text-center text-sm">Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-700 underline">Sign in</Link></p>
    </form>
  );
}
