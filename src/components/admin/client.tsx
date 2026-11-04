"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-a-primary", pendingText = "Saving…", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button {...rest} className={className} disabled={pending || rest.disabled}>{pending ? pendingText : children}</button>;
}

/** Submit button that asks for confirmation first (for deletes etc.). */
export function ConfirmButton({ message = "Are you sure?", children, className = "btn-a-danger", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { message?: string }) {
  return (
    <button {...rest} className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}

/** Auto-submits its parent form on change (for filter selects). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  return <button type="button" className="btn-a" onClick={() => navigator.clipboard.writeText(text)}>{label}</button>;
}

export function PrintButton() {
  return <button type="button" className="btn-a-primary print:hidden" onClick={() => window.print()}>Print</button>;
}
