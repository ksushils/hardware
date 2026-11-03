import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 bg-ink-900 text-slate-300">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div>
          <p className="text-xl font-black text-white">Tech<span className="text-brand-500">Revive</span></p>
          <p className="mt-3 text-sm leading-relaxed">
            The UAE&apos;s home for certified renewed and new PC hardware. Every part is tested, graded and covered by a 12-month warranty.
          </p>
          <p className="mt-4 text-sm">📍 Dubai, United Arab Emirates<br />📞 +971 4 000 0000<br />✉️ support@techrevive.ae<br />🕘 Sun–Fri, 9:00–18:00</p>
        </div>
        <FooterCol title="Shop" links={[["Hot Deals", "/deals"], ["Graphics Cards", "/category/graphics-cards"], ["Processors", "/category/processors"], ["Gaming PCs", "/category/gaming-pcs"], ["Laptops", "/category/laptops"]]} />
        <FooterCol title="Help" links={[["Help Center", "/help"], ["Track Your Order", "/track"], ["Warranty & Returns", "/help#warranty"], ["Delivery", "/help#delivery"], ["Sell / Trade-in", "/sell"]]} />
        <FooterCol title="Company" links={[["About Us", "/about"], ["Our Grading", "/about#grading"], ["Terms & Conditions", "/terms"], ["Privacy Policy", "/privacy"], ["My Account", "/account"]]} />
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col items-center justify-between gap-4 py-6 text-xs md:flex-row">
          <p>© {new Date().getFullYear()} TechRevive Trading LLC. All prices in AED and include 5% VAT.</p>
          <div className="flex flex-wrap gap-2">
            {["VISA", "Mastercard", "Apple Pay", "Google Pay", "Cash on Delivery"].map((p) => (
              <span key={p} className="rounded-md bg-white/10 px-2.5 py-1 font-semibold text-white">{p}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="font-semibold text-white">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map(([l, h]) => (
          <li key={h}><Link href={h} className="hover:text-white">{l}</Link></li>
        ))}
      </ul>
    </div>
  );
}
