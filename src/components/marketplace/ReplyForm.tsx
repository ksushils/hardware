"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { replySellerMessage } from "@/app/actions/seller";

export default function ReplyForm({ id }: { id: string }) {
  const { state, pending, formProps } = useFormAction(replySellerMessage, true);
  return (
    <form {...formProps} className="mt-2 space-y-2">
      <input type="hidden" name="id" value={id} />
      <textarea name="reply" rows={3} placeholder="Write your reply (emailed to the customer)" className="in-a" required />
      <button className="btn-a-primary" disabled={pending}>{pending ? "Sending…" : "Send reply"}</button>
      {state?.error && <span className="ms-2 text-sm text-red-600">{state.error}</span>}
      {state?.ok && <span className="ms-2 text-sm text-emerald-700">{state.ok}</span>}
    </form>
  );
}
