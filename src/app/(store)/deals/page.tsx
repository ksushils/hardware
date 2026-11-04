import type { Metadata } from "next";
import Listing from "@/components/Listing";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.listing.deals.replace("🔥 ", ""), description: t.listing.dealsSub, alternates: { canonical: "/deals" } };
}
export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const { t } = await getI18n();
  return <Listing title={t.listing.deals} subtitle={t.listing.dealsSub} searchParams={await searchParams} base={{ sort: "discount", inStock: true }} />;
}
