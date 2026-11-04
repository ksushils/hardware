import type { Metadata } from "next";
import Listing from "@/components/Listing";
import { getI18n } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.listing.express.replace("⚡ ", ""), description: t.listing.expressSub, alternates: { canonical: "/express" } };
}
export default async function ExpressPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const { t } = await getI18n();
  return <Listing title={t.listing.express} subtitle={t.listing.expressSub} searchParams={await searchParams} base={{ express: true }} />;
}
