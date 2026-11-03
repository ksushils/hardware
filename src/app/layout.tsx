import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "TechRevive UAE: Certified Renewed & New PC Hardware", template: "%s | TechRevive UAE" },
  description: "Buy tested graphics cards, CPUs, SSDs, monitors, laptops and gaming PCs in Dubai and across the UAE. 12-month warranty, free delivery and 14-day returns.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
