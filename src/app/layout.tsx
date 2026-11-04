import type { Metadata } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { getI18n } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import { I18nProvider } from "@/components/I18nProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: s.seo.title, template: `%s | ${s.storeName} UAE` },
    description: s.seo.description,
    icons: { icon: "/favicon.svg" },
    openGraph: { type: "website", siteName: s.storeName, locale: "en_AE", alternateLocale: ["ar_AE"], images: ["/video/hero-poster.jpg"] },
    twitter: { card: "summary_large_image" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t, dir } = await getI18n();
  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${arabic.variable}`}>
      <body className={locale === "ar" ? "font-arabic" : "font-sans"}>
        <I18nProvider value={{ locale, t }}>{children}</I18nProvider>
      </body>
    </html>
  );
}
