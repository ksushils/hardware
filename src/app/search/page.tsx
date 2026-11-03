import Listing from "@/components/Listing";
export const metadata = { title: "Search" };
export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  return <Listing title={q ? `Results for “${q}”` : "All products"} searchParams={sp} base={{}} />;
}
