import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { OrganizationJsonLd } from "@/components/JsonLd";
import ChatWidget from "@/components/ChatWidget";

// Optional hosted chat assistant (https .js address); empty = no chat
const chatSrc = /^https:\/\/[^\s"'<>]+\.js(\?[^\s"'<>]*)?$/.test(process.env.CHAT_WIDGET_SRC ?? "") ? process.env.CHAT_WIDGET_SRC! : "";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <OrganizationJsonLd />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      {chatSrc ? <ChatWidget src={chatSrc} /> : null}
    </div>
  );
}
