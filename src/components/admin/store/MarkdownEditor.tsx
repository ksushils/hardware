"use client";
import { useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

/** Textarea with Write / Preview tabs. Supports ## headings, - lists, **bold**, *italic*, [links](url). */
export default function MarkdownEditor({ name, defaultValue = "", rows = 12, dir = "ltr", label }: { name: string; defaultValue?: string; rows?: number; dir?: "ltr" | "rtl"; label: string }) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs">
          {(["write", "preview"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setTab(t)} className={`rounded-md px-2.5 py-1 capitalize ${tab === t ? "bg-slate-900 text-white" : "text-slate-600"}`}>{t}</button>
          ))}
        </div>
      </div>
      <textarea name={name} value={value} onChange={(e) => setValue(e.target.value)} rows={rows} dir={dir}
        className={`in-a font-mono text-[13px] ${tab === "preview" ? "hidden" : ""}`} />
      {tab === "preview" && (
        <div dir={dir} className="prose-x min-h-40 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || "<p class='text-slate-400'>Nothing to preview</p>" }} />
      )}
      <p className="mt-1 text-xs text-slate-500">Formatting: ## Heading · - list item · **bold** · *italic* · [link](https://…)</p>
    </div>
  );
}
