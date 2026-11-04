"use client";

/** Header checkbox toggling all checkboxes with the given name that belong to form `formId`. */
export function SelectAll({ formId, name = "ids" }: { formId: string; name?: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Select all"
      className="accent-slate-900"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name="${name}"][form="${formId}"]`).forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
