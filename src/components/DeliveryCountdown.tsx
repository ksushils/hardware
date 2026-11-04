"use client";
import { useEffect, useState } from "react";
import { useI18n } from "./I18nProvider";

const CUTOFF_HOUR = 15; // 3 PM Dubai time (UTC+4, no DST)

/** "Order within 3h 12m for delivery tomorrow, Thu 6 Nov" (skips Saturdays, when we don't deliver). */
export default function DeliveryCountdown() {
  const { locale } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!now) return null;
  const dubai = new Date(now.getTime() + (now.getTimezoneOffset() + 240) * 60_000);
  const cutoff = new Date(dubai);
  cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
  let daysAhead = 1;
  if (dubai >= cutoff) { cutoff.setDate(cutoff.getDate() + 1); daysAhead = 2; }
  const delivery = new Date(dubai);
  delivery.setDate(delivery.getDate() + daysAhead);
  if (delivery.getDay() === 6) delivery.setDate(delivery.getDate() + 1);
  const mins = Math.max(0, Math.round((cutoff.getTime() - dubai.getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  const day = delivery.toLocaleDateString(locale === "ar" ? "ar-AE" : "en-AE", { weekday: "long", day: "numeric", month: "short" });
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
      <span className="text-xl">⚡</span>
      <p>
        {locale === "ar" ? <>اطلب خلال <b className="text-emerald-700">{h} س {m} د</b> ليصلك <b>{day}</b></> : <>Order within <b className="text-emerald-700">{h}h {m}m</b> to get it <b>{day}</b></>}
      </p>
    </div>
  );
}
