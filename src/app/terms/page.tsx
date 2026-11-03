import Prose from "@/components/Prose";
export const metadata = { title: "Terms & Conditions" };
export default function Terms() {
  return (
    <Prose title="Terms & Conditions">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Template text. Have it reviewed by a UAE legal advisor before you launch.</p>
      <h2>Orders & pricing</h2>
      <p>All prices are in UAE Dirhams (AED) and include 5% VAT. We reserve the right to cancel orders affected by pricing errors or stock unavailability, with a full refund.</p>
      <h2>Payments</h2>
      <p>Card payments are processed by a PCI-DSS compliant payment provider. We never store your full card details.</p>
      <h2>Warranty</h2>
      <p>Renewed products carry a 12-month warranty against functional defects. It does not cover physical damage, liquid damage or unauthorised modification.</p>
      <h2>Returns</h2>
      <p>You may return products within 14 days of delivery in their original condition. Refunds go to the original payment method within 5–10 business days.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the United Arab Emirates and the Emirate of Dubai.</p>
    </Prose>
  );
}
