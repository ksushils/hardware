"use client";
import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";

type Img = { url: string; alt: string; unit?: boolean };

/**
 * Product gallery. When the selected seller offer has photos of the exact unit, they come first and are captioned
 * as such; otherwise (for used/refurbished offers) a note says the catalogue image may not show the unit received.
 */
export default function Gallery({ images }: { images: { url: string; alt: string }[] }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [unitPhotos, setUnitPhotos] = useState<string[]>([]);
  const [stockWarning, setStockWarning] = useState(false);
  const [variantImage, setVariantImage] = useState<string | null>(null);

  useEffect(() => {
    const onOffer = (e: Event) => {
      const d = (e as CustomEvent<{ photos: string[]; stockImageWarning: boolean; variantImage: string | null }>).detail;
      setUnitPhotos(d.photos ?? []);
      setStockWarning(!!d.stockImageWarning && !(d.photos?.length));
      setVariantImage(d.variantImage ?? null);
      setI(0);
    };
    window.addEventListener("tr-offer-photos", onOffer);
    return () => window.removeEventListener("tr-offer-photos", onOffer);
  }, []);

  const list: Img[] = [
    ...unitPhotos.map((url, n) => ({ url, alt: ar ? `صورة القطعة ${n + 1}` : `Photo ${n + 1} of this exact unit`, unit: true })),
    // a variant-specific catalogue image (e.g. a colour) is shown ahead of the generic ones when there are no unit photos
    ...(!unitPhotos.length && variantImage && !images.some((x) => x.url === variantImage) ? [{ url: variantImage, alt: images[0]?.alt ?? "" }] : []),
    ...images,
  ];
  const cur = list[Math.min(i, list.length - 1)] ?? list[0];
  return (
    <div>
      <button type="button" onClick={() => setZoom(true)} className="card relative block aspect-square w-full cursor-zoom-in overflow-hidden" aria-label={ar ? "تكبير" : "Zoom"}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.url} alt={cur.alt} className={`h-full w-full ${cur.unit ? "object-cover" : "object-contain p-10"}`} fetchPriority="high" />
        {cur.unit && <span className="absolute bottom-3 start-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">📷 {ar ? "صور هذه القطعة تحديدًا" : "Photos of this exact unit"}</span>}
      </button>
      {!cur.unit && stockWarning && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{ar ? "صورة من الكتالوج — قد لا تُظهر القطعة التي ستستلمها." : "Catalogue image — it may not show the exact unit you will receive."}</p>
      )}
      {list.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {list.map((img, idx) => (
            <button key={img.url + idx} type="button" onClick={() => setI(idx)} className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-white ${idx === i ? "border-brand-600" : "border-slate-200"}`} aria-label={`${ar ? "صورة" : "Image"} ${idx + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className={`h-full w-full ${img.unit ? "object-cover" : "object-contain p-2"}`} />
              {img.unit && <span className="absolute bottom-0 inset-x-0 bg-black/60 text-center text-[9px] text-white">{ar ? "القطعة" : "UNIT"}</span>}
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
