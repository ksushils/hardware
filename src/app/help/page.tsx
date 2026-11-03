import Link from "next/link";
import Prose from "@/components/Prose";
export const metadata = { title: "Help Center" };
const faqs: [string, string][] = [
  ["What does “Certified Renewed” mean?", "Pre-owned or open-box hardware that has been inspected, cleaned, stress-tested and graded by our technicians in Dubai. Renewed items perform like new."],
  ["What do the condition grades mean?", "Excellent: like new, no visible marks. Very Good: light marks that are invisible once installed. Good: visible cosmetic wear and fully functional. Brand New: sealed retail box."],
  ["How do I pay?", "We accept Visa, Mastercard, Apple Pay and Google Pay through our secure checkout. Cash or card on delivery is available for orders up to AED 5,000, with an AED 10 fee."],
  ["Can I pay in installments?", "Yes. Eligible orders can be split into 4 interest-free payments."],
  ["Are GPUs ex-mining?", "No. We screen every supplier and reject cards with signs of mining use."],
];
export default function Help() {
  return (
    <Prose title="Help Center">
      <p>Need a hand? Email <b>support@techrevive.ae</b> or call <b>+971 4 000 0000</b> (Sun–Fri, 9:00–18:00). To check an order, use <Link href="/track" className="text-brand-700 underline">Track Your Order</Link>.</p>
      <h2 id="delivery">Delivery</h2>
      <ul>
        <li>Standard delivery (2–4 business days) to all 7 emirates. Free on orders over AED 200, otherwise AED 15.</li>
        <li>Express next-day delivery (AED 25) on Express items ordered before 3 PM.</li>
        <li>Orders are dispatched from our Dubai warehouse, Sunday to Friday.</li>
      </ul>
      <h2 id="warranty">Warranty & returns</h2>
      <ul>
        <li>Every renewed product includes a 12-month TechRevive warranty. New products carry the manufacturer warranty.</li>
        <li>Add TechRevive Care+ to extend coverage to 24 months, with express replacement.</li>
        <li>Return any item within 14 days of delivery for a full refund, as long as it is in the same condition with all accessories.</li>
        <li>To raise a claim, email us your order number and a short description of the issue.</li>
      </ul>
      <h2>FAQ</h2>
      {faqs.map(([q, a]) => (
        <details key={q} className="card p-4"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm">{a}</p></details>
      ))}
    </Prose>
  );
}
