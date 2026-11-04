"use client";
import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";

type Cfg = { showCountdown: boolean; cutoffHour: number; noDeliveryWeekdays: number[] };

/** "Order within 3h 12m to get it Thursday, 5 Nov". Cutoff and non-delivery days come from Admin → Settings (not hard-coded). */
export default function DeliveryCountdown() {
  const { locale } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  useEffect(() => {
    setNow(new Date());
    fetch("/api/delivery-config").then((r) => r.json()).then(setCfg).catch(() => {});
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now || !cfg || !cfg.showCountdown) return null;
  const dubai = new Date(now.getTime() + (now.getTimezoneOffset() + 240) * 60_000); // UAE is UTC+4 all year
  const cutoff = new Date(dubai);
  cutoff.setHours(cfg.cutoffHour, 0, 0, 0);
  let daysAhead = 1;
  if (dubai >= cutoff) { cutoff.setDate(cutoff.getDate() + 1); daysAhead = 2; }
  const delivery = new Date(dubai);
  delivery.setDate(delivery.getDate() + daysAhead);
  for (let i = 0; i < 7 && cfg.noDeliveryWeekdays.includes(delivery.getDay()); i++) delivery.setDate(delivery.getDate() + 1);
  const mins = Math.max(0, Math.round((cutoff.getTime() - dubai.getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  const day = delivery.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", { weekday: "long", day: "numeric", month: "short" });
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <span className="text-xl">⚡</span>
      <p>{locale === "ar" ? <>اطلب خلال <b className="text-emerald-700">{h} س {m} د</b> ليصلك <b>{day}</b></> : <>Order within <b className="text-emerald-700">{h}h {m}m</b> to get it <b>{day}</b></>}</p>
    </div>
  );
}
