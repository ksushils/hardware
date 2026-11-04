import { Badge } from "@/components/admin/ui";
import { STATUS_TONE, statusLabel, type Locale, type Sla } from "@/lib/caseLabels";

export function CaseStatusBadge({ status, locale = "en", audience = "staff" }: { status: string; locale?: Locale; audience?: "staff" | "buyer" | "seller" }) {
  return <Badge tone={STATUS_TONE[status] ?? "gray"}>{statusLabel(status, locale, audience)}</Badge>;
}
export function SlaBadge({ sla }: { sla: Sla }) {
  return sla ? <Badge tone={sla.tone}>{sla.label}</Badge> : null;
}
