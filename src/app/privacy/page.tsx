import Prose from "@/components/Prose";
export const metadata = { title: "Privacy Policy" };
export default function Privacy() {
  return (
    <Prose title="Privacy Policy">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Template text. Align it with the UAE Personal Data Protection Law (PDPL) before you launch.</p>
      <p>We collect the information needed to process your orders: your name, email, phone, delivery address and order history. Payment details are handled by our payment provider and never stored on our servers.</p>
      <p>We use essential cookies to keep you signed in and remember your cart. We don&apos;t sell your personal data.</p>
      <p>To request access to or deletion of your data, email privacy@techrevive.ae.</p>
    </Prose>
  );
}
