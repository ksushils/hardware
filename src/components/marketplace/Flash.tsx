export default function Flash({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  return <div className={`mb-4 rounded-lg px-4 py-2.5 text-sm font-medium ${error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{error ?? msg}</div>;
}
