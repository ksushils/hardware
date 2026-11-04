"use client";
import { useFormAction } from "@/hooks/useFormAction";

type State = { error?: string; ok?: string } | undefined;

/** Client form wrapper: submits a server action without resetting fields and shows the result. */
export default function FormShell({
  action, children, submitLabel = "Save", className = "space-y-4", resetOnOk = false, footer,
}: {
  action: (s: State, fd: FormData) => Promise<State>; children: React.ReactNode; submitLabel?: string; className?: string; resetOnOk?: boolean; footer?: React.ReactNode;
}) {
  const { state, pending, formProps } = useFormAction(action, resetOnOk);
  return (
    <form {...formProps} className={className}>
      {children}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
        {state?.error && <p className="me-auto text-sm text-red-600">{state.error}</p>}
        {state?.ok && <p className="me-auto text-sm text-emerald-700">✓ {state.ok}</p>}
        {footer}
        <button className="btn-a-primary" disabled={pending}>{pending ? "Saving…" : submitLabel}</button>
      </div>
    </form>
  );
}
