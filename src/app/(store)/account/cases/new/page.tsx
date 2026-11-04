import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import NewCasePage, { type NewCaseParams } from "@/components/cases/NewCasePage";

export const metadata: Metadata = { title: "Report a problem", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<NewCaseParams> }) {
  const user = await requireUser("/account/cases/new");
  return <NewCasePage user={user} sp={await searchParams} />;
}
