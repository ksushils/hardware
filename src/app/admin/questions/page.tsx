import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Card, PageHeader, Tabs, EmptyState, Badge } from "@/components/admin/ui";
import { SubmitButton } from "@/components/admin/client";
import Flash from "@/components/marketplace/Flash";
import { answerQuestion } from "@/app/actions/admin/sellers";

export const metadata = { title: "Product questions" };

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; error?: string }> }) {
  await requirePermission("products");
  const sp = await searchParams;
  const tab = sp.tab === "answered" ? "answered" : sp.tab === "all" ? "all" : "open";
  const where = tab === "open" ? { answer: null } : tab === "answered" ? { answer: { not: null } } : {};
  const [questions, open] = await Promise.all([
    db.productQuestion.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    db.productQuestion.count({ where: { answer: null } }),
  ]);
  const products = await db.product.findMany({ where: { id: { in: questions.map((q) => q.productId) } }, select: { id: true, name: true, slug: true, seller: { select: { shopName: true } } } });
  return (
    <>
      <PageHeader title="Product questions" subtitle="Answer customer questions. Published answers appear on the product page and help with SEO." />
      <Flash msg={sp.msg} error={sp.error} />
      <Card pad={false}>
        <Tabs current={tab} tabs={[{ key: "open", label: "Unanswered", href: "/admin/questions", count: open }, { key: "answered", label: "Answered", href: "/admin/questions?tab=answered" }, { key: "all", label: "All", href: "/admin/questions?tab=all" }]} />
        {questions.length ? (
          <div className="divide-y divide-slate-100">
            {questions.map((q) => {
              const p = products.find((x) => x.id === q.productId);
              return (
                <div key={q.id} className="p-4 text-sm">
                  <p className="text-xs text-slate-500">{p ? <Link href={`/products/${p.slug}`} target="_blank" className="font-semibold text-sky-700 hover:underline">{p.name}</Link> : "Deleted product"}{p?.seller && <> · 🏪 {p.seller.shopName}</>} · {q.name} ({q.email}) · {q.createdAt.toLocaleString("en-AE")} {q.published ? <Badge tone="green">Published</Badge> : <Badge>Hidden</Badge>}</p>
                  <p className="mt-1 font-semibold">Q: {q.question}</p>
                  <form action={answerQuestion} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={q.id} />
                    <textarea name="answer" defaultValue={q.answer ?? ""} rows={2} placeholder="Write an answer (the customer is emailed when first answered)" className="in-a min-w-72 flex-1" />
                    <div className="flex flex-col gap-1">
                      <SubmitButton name="action" value="answer" className="btn-a-primary">{q.answer ? "Update & publish" : "Answer & publish"}</SubmitButton>
                      {q.published && <button name="action" value="unpublish" className="btn-a">Unpublish</button>}
                      <button name="action" value="delete" className="btn-a-danger">Delete</button>
                    </div>
                  </form>
                </div>
              );
            })}
          </div>
        ) : <EmptyState title={tab === "open" ? "No unanswered questions 🎉" : "No questions"} />}
      </Card>
    </>
  );
}
