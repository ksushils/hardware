"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// The hosted website chat assistant (env CHAT_WIDGET_SRC). Storefront pages only, and never on checkout or
// payment pages, so nothing sits over the card form. The script draws its own button and chat window.
const NO_CHAT = [/^\/checkout/, /^\/order/];

export default function ChatWidget({ src }: { src: string }) {
  const pathname = usePathname() || "/";
  const allowed = !NO_CHAT.some((r) => r.test(pathname));
  useEffect(() => {
    if (!allowed || document.getElementById("techrevive-chat")) return;
    const s = document.createElement("script");
    s.src = src;
    s.id = "techrevive-chat";
    s.async = true;
    document.body.appendChild(s);
  }, [allowed, src]);
  // leaving for checkout after the chat loaded: hide its button and window there
  return allowed ? null : <style>{".wc{display:none!important}"}</style>;
}
