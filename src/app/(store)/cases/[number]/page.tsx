import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import BuyerCaseView from "@/components/cases/BuyerCaseView";

export const metadata: Metadata = { title: "Support case", robots: { index: false } };

// Emailed link for guest buyers: /cases/CS-…?k=<signed key>. Signed-in owners can use it too.
export default async function Page({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ k?: string }> }) {
  const { number } = await params;
  return <BuyerCaseView number={number} k={(await searchParams).k} user={await getUser()} />;
}
