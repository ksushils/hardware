import Listing from "@/components/Listing";
export const metadata = { title: "Express Delivery" };
export default async function ExpressPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  return <Listing title="⚡ TechRevive Express" subtitle="Order by 3 PM for next-day delivery anywhere in the UAE." searchParams={await searchParams} base={{ express: true }} />;
}
