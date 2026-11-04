import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import NewCasePage, { type NewCaseParams } from "@/components/cases/NewCasePage";

export const metadata: Metadata = { title: "Report a problem", robots: { index: false } };

// Guest-friendly entry point: reached from the "Report a problem" link on an order opened with its emailed key.
export default async function Page({ searchParams }: { searchParams: Promise<NewCaseParams> }) {
  return <NewCasePage user={await getUser()} sp={await searchParams} />;
}
