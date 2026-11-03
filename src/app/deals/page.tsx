import Listing from "@/components/Listing";
export const metadata = { title: "Hot Deals" };
export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  return <Listing title="🔥 Hot Deals" subtitle="The biggest savings compared to buying new." searchParams={await searchParams} base={{ sort: "discount", inStock: true }} />;
}
