import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import en from "@/i18n/en";
import ar from "@/i18n/ar";
import { getSettings } from "./settings";

export type Locale = "en" | "ar";
export type Dict = typeof en;
export const LOCALE_COOKIE = "locale";

export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  const s = await getSettings();
  if (!s.languages.arabicEnabled) return "en";
  if (c === "ar" || c === "en") return c;
  return s.languages.defaultLocale;
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: locale === "ar" ? (ar as Dict) : en, dir: locale === "ar" ? "rtl" : "ltr" } as const;
}

/** Replace {name} placeholders. */
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
