"use client";
import { useEffect, useState } from "react";

export default function Gallery({ images }: { images: { url: string; alt: string }[] }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [list, setList] = useState(images);
  useEffect(() => {
    const onVariant = (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      const idx = list.findIndex((x) => x.url === url);
      if (idx >= 0) setI(idx);
      else { setList([{ url, alt: images[0]?.alt ?? "" }, ...images]); setI(0); }
    };
    window.addEventListener("tr-variant-image", onVariant);
    return () => window.removeEventListener("tr-variant-image", onVariant);
  }, [list, images]);
  const cur = list[i] ?? list[0];
  return (
    <div>
      <button type="button" onClick={() => setZoom(true)} className="card relative block aspect-square w-full cursor-zoom-in overflow-hidden" aria-label="Zoom">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url} alt={cur.alt} className="h-full w-full object-contain p-10" fetchPriority="high" />
      </button>
      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {list.map((img, idx) => (
            <button key={img.url + idx} type="button" onClick={() => setI(idx)} className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${idx === i ? "border-brand-600" : "border-slate-200"}`} aria-label={`Image ${idx + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-contain p-2" />
            </button>
          ))}
        </div>
      )}
      {zoom && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" onClick={() => setZoom(false)} role="dialog" aria-modal="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.url} alt={cur.alt} className="max-h-full max-w-full rounded-2xl bg-white object-contain p-6" />
        </div>
      )}
    </div>
  );
}
