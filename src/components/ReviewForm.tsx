"use client";
import { useState } from "react";
import { useFormAction } from "@/hooks/useFormAction";
import { submitReview } from "@/app/actions/account";
import { useI18n } from "./I18nProvider";
import { StarIcon } from "./Icons";

export default function ReviewForm({ productId }: { productId: string }) {
  const { t } = useI18n();
  const { state, pending, formProps } = useFormAction(submitReview, true);
  const [rating, setRating] = useState(0);
  return (
    <form {...formProps} className="card space-y-3 p-5">
      <p className="font-semibold">{t.product.writeReview}</p>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1 text-amber-400">
        {[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} onClick={() => setRating(i)} aria-label={`${i}/5`}><StarIcon filled={i <= rating} className="h-7 w-7" /></button>)}
      </div>
      <textarea name="comment" rows={3} className="input" placeholder={t.product.reviewPlaceholder} />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-brand-700">{state.ok}</p>}
      <button className="btn-dark" disabled={pending}>{pending ? t.product.submitting : t.product.submitReview}</button>
    </form>
  );
}
