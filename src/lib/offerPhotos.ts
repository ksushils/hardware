import "server-only";
import { saveUpload } from "./uploads";
import { cleanPhotoUrls } from "./offerTerms";

/** Merge the unit photos a seller kept (JSON in `photos`) with newly uploaded files (`newPhotos`). Public listing photos, max 8. */
export async function collectPhotos(fd: FormData, label: string): Promise<{ photos?: string[]; error?: string }> {
  let kept: unknown = [];
  try { kept = JSON.parse(String(fd.get("photos") || "[]")); } catch { /* ignore */ }
  const photos = cleanPhotoUrls(kept);
  for (const f of fd.getAll("newPhotos")) {
    if (!(f instanceof File) || !f.size) continue;
    if (photos.length >= 8) return { error: "You can add up to 8 photos per offer." };
    try {
      const m = await saveUpload(f, label);
      if (!m.mime.startsWith("image/")) return { error: "Unit photos must be images." };
      photos.push(m.url);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Photo upload failed" };
    }
  }
  return { photos };
}
