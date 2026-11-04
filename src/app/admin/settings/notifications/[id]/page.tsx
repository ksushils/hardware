import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { Badge, Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Email" };

export default async function EmailPreview({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("settings");
  const e = await db.emailLog.findUnique({ where: { id: (await params).id } });
  if (!e) notFound();
  return (
    <div className="space-y-5">
      <PageHeader title={e.subject} back="/admin/settings/notifications" subtitle={`To ${e.to} · ${e.createdAt.toLocaleString("en-AE")} · ${e.template}`} actions={<Badge tone={e.status === "SENT" ? "green" : e.status === "FAILED" ? "red" : "gray"}>{e.status}</Badge>} />
      {e.error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs text-red-700">{e.error}</div>}
      <Card pad={false}>
        {/* sandbox with no permissions: no scripts, no navigation */}
        <iframe title="Email preview" sandbox="" srcDoc={e.html} className="h-[70vh] w-full rounded-xl bg-white" />
      </Card>
    </div>
  );
}
