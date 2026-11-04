// Small server-safe helpers for settings forms.
export function Toggle({ name, label, help, defaultChecked }: { name: string; label: string; help?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-start gap-3 py-1.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-slate-900" />
      <span><span className="block text-sm font-medium text-slate-800">{label}</span>{help && <span className="block text-xs text-slate-500">{help}</span>}</span>
    </label>
  );
}
export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
