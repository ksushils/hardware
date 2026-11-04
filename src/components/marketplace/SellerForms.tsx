"use client";
import { useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { contactSeller, rateSeller } from "@/app/actions/marketplace";
import { useI18n } from "@/components/I18nProvider";

export function ContactSellerForm({ sellerId, productId, name, email }: { sellerId: string; productId?: string; name?: string; email?: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { state, pending, formProps } = useFormAction(contactSeller, true);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="sellerId" value={sellerId} />
      {productId && <input type="hidden" name="productId" value={productId} />}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="fromName" defaultValue={name} required placeholder={ar ? "اسمك" : "Your name"} className="input" />
        <input name="fromEmail" type="email" defaultValue={email} required placeholder={ar ? "بريدك الإلكتروني" : "Your email"} className="input" />
      </div>
      <input name="subject" required placeholder={ar ? "الموضوع" : "Subject"} className="input" />
      <textarea name="body" required rows={4} placeholder={ar ? "اكتب رسالتك…" : "Your message…"} className="input" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-brand-700">✓ {state.ok}</p>}
      <button className="btn-dark" disabled={pending}>{pending ? "…" : ar ? "إرسال" : "Send message"}</button>
    </form>
  );
}

export function RateSellerForm({ sellerId }: { sellerId: string }) {
  const { locale } = useI18n();
  const ar = locale === "ar";
  const { state, pending, formProps } = useFormAction(rateSeller);
  const [rating, setRating] = useState(0);
  return (
    <form {...formProps} className="card space-y-3 p-5">
      <p className="font-semibold">{ar ? "قيّم هذا البائع" : "Rate this seller"}</p>
      <input type="hidden" name="sellerId" value={sellerId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1 text-2xl text-amber-400">
        {[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} onClick={() => setRating(i)} aria-label={`${i}`}>{i <= rating ? "★" : "☆"}</button>)}
      </div>
      <textarea name="comment" rows={3} required placeholder={ar ? "كيف كانت تجربتك مع البائع؟" : "How was your experience with this seller?"} className="input" />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm font-semibold text-brand-700">{state.ok}</p>}
      <button className="btn-dark" disabled={pending}>{ar ? "إرسال التقييم" : "Submit rating"}</button>
    </form>
  );
}
