import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export async function OrganizationJsonLd() {
  const s = await getSettings();
  const url = siteUrl();
  return (
    <JsonLd
      data={[
        {
          "@context": "https://schema.org", "@type": "OnlineStore", name: s.storeName, legalName: s.legalName, url, logo: `${url}/favicon.svg`,
          email: s.email, telephone: s.phone, address: { "@type": "PostalAddress", addressLocality: "Dubai", addressCountry: "AE" },
          sameAs: Object.values(s.social).filter(Boolean),
          hasMerchantReturnPolicy: { "@type": "MerchantReturnPolicy", applicableCountry: "AE", returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow", merchantReturnDays: s.returnsDays },
        },
        { "@context": "https://schema.org", "@type": "WebSite", name: s.storeName, url, potentialAction: { "@type": "SearchAction", target: `${url}/search?q={search_term_string}`, "query-input": "required name=search_term_string" } },
      ]}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  return <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: siteUrl() + it.url })) }} />;
}
