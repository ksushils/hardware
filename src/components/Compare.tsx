"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "./I18nProvider";

const KEY = "tr_compare";
const EVT = "tr-compare";
export function readCompare(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function writeCompare(list: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
  window.dispatchEvent(new Event(EVT));
}
function useCompare() {
  const [list, setList] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setList(readCompare());
    sync();
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return list;
}

export function CompareToggle({ slug, compact }: { slug: string; compact?: boolean }) {
  const list = useCompare();
  const { locale } = useI18n();
  const on = list.includes(slug);
  return (
    <button type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); writeCompare(on ? list.filter((s) => s !== slug) : [...list.filter((s) => s !== slug), slug].slice(-4)); }}
      className={compact ? `rounded-full border px-2.5 py-1 text-xs font-semibold backdrop-blur ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white/90 text-slate-700 hover:border-slate-500"}` : `btn-outline ${on ? "border-brand-600 text-brand-700" : ""}`}
      aria-pressed={on}>
      {on ? "✓ " : "⇄ "}{locale === "ar" ? (on ? "في المقارنة" : "قارن") : on ? "Comparing" : "Compare"}
    </button>
  );
}

export default function CompareLink() {
  const list = useCompare();
  const { locale } = useI18n();
  if (!list.length) return null;
  return (
    <Link href={`/compare?p=${list.join(",")}`} className="relative hidden rounded-xl px-2.5 py-2 text-sm font-semibold hover:bg-slate-100 sm:block" title={locale === "ar" ? "مقارنة" : "Compare"}>
      ⇄<span className="absolute -end-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-ink-900 px-1 text-[11px] font-bold text-white">{list.length}</span>
    </Link>
  );
}

export function CompareRemove({ slug }: { slug: string }) {
  return (
    <button type="button" className="text-xs text-slate-500 hover:text-red-600"
      onClick={() => { const next = readCompare().filter((s) => s !== slug); writeCompare(next); window.location.href = next.length ? `/compare?p=${next.join(",")}` : "/compare"; }}>✕</button>
  );
}
