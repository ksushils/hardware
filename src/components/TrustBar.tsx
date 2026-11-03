import { CardIcon, ReturnIcon, ShieldIcon, TruckIcon } from "./Icons";

const items = [
  { icon: ShieldIcon, title: "12-Month Warranty", sub: "On every renewed part" },
  { icon: TruckIcon, title: "Free Delivery", sub: "Across the UAE over AED 200" },
  { icon: ReturnIcon, title: "14-Day Returns", sub: "No questions asked" },
  { icon: CardIcon, title: "Buy Now, Pay Later", sub: "Split into 4 payments" },
];

export default function TrustBar() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(({ icon: Icon, title, sub }) => (
        <div key={title} className="card flex items-center gap-3 p-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-6 w-6" /></span>
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
