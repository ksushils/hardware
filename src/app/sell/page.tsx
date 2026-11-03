import Prose from "@/components/Prose";
export const metadata = { title: "Sell or Trade-in" };
export default function Sell() {
  return (
    <Prose title="Sell or trade in your hardware">
      <p>Upgrading? We buy GPUs, CPUs, laptops, monitors and full gaming PCs from across the UAE. Get a quote within 24 hours, free collection, and payment by bank transfer or store credit worth 10% more.</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>Email <b>sell@techrevive.ae</b> with the model, condition, photos and any accessories.</li>
        <li>We send you a guaranteed quote.</li>
        <li>A courier collects the item for free. We test it and pay you within 2 business days.</li>
      </ol>
    </Prose>
  );
}
