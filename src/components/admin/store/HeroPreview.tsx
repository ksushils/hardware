"use client";
import { useEffect, useState } from "react";

/** Live preview of the homepage hero, reading values from the surrounding form inputs by name. */
export default function HeroPreview({ formId }: { formId: string }) {
  const [v, setV] = useState({ title: "", highlight: "", subtitle: "", videoUrl: "", posterUrl: "", overlayOpacity: "60", annEnabled: true, annText: "" });
  useEffect(() => {
    const form = document.getElementById(formId)?.closest("form") ?? (document.getElementById(formId) as HTMLFormElement | null);
    if (!form) return;
    const read = () => {
      const g = (n: string) => (form.querySelector(`[name="${n}"]`) as HTMLInputElement | null);
      setV({
        title: g("title")?.value ?? "", highlight: g("highlight")?.value ?? "", subtitle: g("subtitle")?.value ?? "",
        videoUrl: g("videoUrl")?.value ?? "", posterUrl: g("posterUrl")?.value ?? "", overlayOpacity: g("overlayOpacity")?.value ?? "60",
        annEnabled: !!g("annEnabled")?.checked, annText: g("annText")?.value ?? "",
      });
    };
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => { form.removeEventListener("input", read); form.removeEventListener("change", read); };
  }, [formId]);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
      {v.annEnabled && <div className="truncate bg-slate-900 px-3 py-1 text-[10px] text-white">{v.annText}</div>}
      <div className="relative aspect-[16/8] bg-slate-900">
        {v.videoUrl && <video key={v.videoUrl} src={v.videoUrl} poster={v.posterUrl || undefined} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-slate-950" style={{ opacity: Number(v.overlayOpacity) / 100 }} />
        <div className="relative p-5 text-white">
          <p className="text-xl font-black leading-tight">{v.title}</p>
          <p className="text-xl font-black leading-tight text-emerald-400">{v.highlight}</p>
          <p className="mt-2 line-clamp-3 max-w-xs text-[11px] text-slate-200">{v.subtitle}</p>
          <span className="mt-3 inline-block rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-semibold">Shop now</span>
        </div>
      </div>
      <p className="bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">Live preview (English)</p>
    </div>
  );
}
