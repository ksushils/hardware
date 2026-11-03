import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import Listing from "@/components/Listing";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[]>> };

export async function generateMetadata({ params }: Props) {
  const c = await db.category.findUnique({ where: { slug: (await params).slug } });
  return { title: c ? `${c.name}: Renewed & New` : "Category" };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await db.category.findUnique({ where: { slug } });
  if (!category) notFound();
  return <Listing title={category.name} subtitle={category.description} searchParams={await searchParams} base={{ category: slug }} />;
}
