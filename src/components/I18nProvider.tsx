"use client";
import { createContext, useContext } from "react";
import type en from "@/i18n/en";

type Ctx = { locale: "en" | "ar"; t: typeof en };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const v = useContext(I18nContext);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
export function fmt(s: string, vars: Record<string, string | number>) {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
