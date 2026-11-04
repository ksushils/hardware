"use client";
import { useFormAction } from "@/hooks/useFormAction";
import { uploadFiles } from "@/app/actions/admin/content";

export default function UploadForm() {
  const { state, pending, formProps } = useFormAction(uploadFiles, true);
  return (
    <form {...formProps} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-white p-5">
      <input type="file" name="files" multiple accept="image/*,video/mp4,video/webm" className="flex-1 text-sm" />
      <button className="btn-a-primary" disabled={pending}>{pending ? "Uploading…" : "Upload files"}</button>
      {state?.ok && <p className="w-full text-sm text-emerald-700">✓ {state.ok}</p>}
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      <p className="w-full text-xs text-slate-500">PNG, JPG, WebP, GIF, SVG, MP4, WebM · up to 25MB each.</p>
    </form>
  );
}
