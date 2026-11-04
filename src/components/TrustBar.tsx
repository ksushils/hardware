import { getI18n } from "@/lib/i18n";
import { CardIcon, ReturnIcon, ShieldIcon, TruckIcon } from "./Icons";

export default async function TrustBar() {
  const { t } = await getI18n();
  const items = [
    { icon: ShieldIcon, title: t.trust.warranty, sub: t.trust.warrantySub },
    { icon: TruckIcon, title: t.trust.delivery, sub: t.trust.deliverySub },
    { icon: ReturnIcon, title: t.trust.returns, sub: t.trust.returnsSub },
    { icon: CardIcon, title: t.trust.bnpl, sub: t.trust.bnplSub },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(({ icon: Icon, title, sub }) => (
        <div key={title} className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-6 w-6" /></span>
          <div><p className="text-sm font-bold">{title}</p><p className="text-xs text-slate-500">{sub}</p></div>
        </div>
      ))}
    </div>
  );
}
