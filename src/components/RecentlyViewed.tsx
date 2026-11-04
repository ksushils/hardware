"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";
import { aed, loc } from "@/lib/format";

type Item = { slug: string; name: string; nameAr: string; image: string; price: number };
const KEY = "tr_recent";

/** Records the current product and shows the others the shopper viewed recently. */
export default function RecentlyViewed({ current }: { current?: Item }) {
  const { locale } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let list: Item[] = [];
    try { list = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
    if (current) {
      list = [current, ...list.filter((i) => i.slug !== current.slug)].slice(0, 12);
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
    }
    setItems(list.filter((i) => i.slug !== current?.slug).slice(0, 6));
  }, [current]);
  if (!items.length) return null;
  return (
    <section className="mt-14">
      <h2 className="h-section">{locale === "ar" ? "شاهدتها مؤخرًا" : "Recently viewed"}</h2>
      <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
        {items.map((i) => (
          <Link key={i.slug} href={`/products/${i.slug}`} className="card w-40 shrink-0 p-3 transition hover:shadow">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.image} alt="" className="aspect-square w-full rounded-lg bg-slate-50 object-contain p-2" />
            <p className="mt-2 line-clamp-2 text-xs font-semibold">{loc(locale, i.name, i.nameAr)}</p>
            <p className="text-sm font-bold">{aed(i.price, locale)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
