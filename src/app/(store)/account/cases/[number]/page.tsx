import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import BuyerCaseView from "@/components/cases/BuyerCaseView";

export const metadata: Metadata = { title: "Support case", robots: { index: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ k?: string }> }) {
  const { number } = await params;
  const user = await requireUser(`/account/cases/${number}`);
  return <BuyerCaseView number={number} k={(await searchParams).k} user={user} />;
}
