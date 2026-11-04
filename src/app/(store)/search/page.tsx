import type { Metadata } from "next";
import Listing from "@/components/Listing";
import { getI18n, fmt } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.common.search, robots: { index: false, follow: true } };
}
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { t } = await getI18n();
  const q = typeof sp.q === "string" ? sp.q : "";
  return <Listing title={q ? fmt(t.listing.resultsFor, { q }) : t.common.allProducts} searchParams={sp} base={{}} />;
}
