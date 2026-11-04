"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getSettings, updateSettings } from "@/lib/settings";
import { saveUpload } from "@/lib/uploads";
import { EMIRATES } from "@/lib/format";

type FS = { error?: string; ok?: string } | undefined;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const b = (fd: FormData, k: string) => fd.get(k) === "on";
const n = (fd: FormData, k: string, def = 0) => {
  const v = Number(fd.get(k));
  return Number.isFinite(v) && String(fd.get(k) ?? "") !== "" ? v : def;
};

async function upload(fd: FormData, key: string): Promise<string | null> {
  const f = fd.get(key);
  if (f instanceof File && f.size) return (await saveUpload(f)).url;
  return null;
}

async function done(user: { id: string; name: string }, section: string): Promise<FS> {
  await logActivity(user, "updated", "settings", `Updated ${section} settings`);
  revalidatePath("/", "layout");
  return { ok: "Settings saved." };
}

export async function saveGeneral(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  if (!s(fd, "storeName")) return { error: "Store name is required." };
  const email = s(fd, "email");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email." };
  const trn = s(fd, "trn");
  if (trn && !/^\d{15}$/.test(trn)) return { error: "TRN must be 15 digits." };
  let logoUrl = s(fd, "logoUrl");
  try {
    logoUrl = (await upload(fd, "logoFile")) ?? logoUrl;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }
  await updateSettings({
    storeName: s(fd, "storeName"), storeNameAr: s(fd, "storeNameAr"), legalName: s(fd, "legalName"), trn,
    email, phone: s(fd, "phone"), whatsapp: s(fd, "whatsapp").replace(/\D/g, ""),
    address: s(fd, "address"), addressAr: s(fd, "addressAr"), hours: s(fd, "hours"), hoursAr: s(fd, "hoursAr"), logoUrl,
    social: { instagram: s(fd, "instagram"), facebook: s(fd, "facebook"), x: s(fd, "x"), tiktok: s(fd, "tiktok"), youtube: s(fd, "youtube") },
    seo: { title: s(fd, "seoTitle"), description: s(fd, "seoDescription") },
  });
  return done(user, "general");
}

export async function saveTheme(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  let videoUrl = s(fd, "videoUrl"), posterUrl = s(fd, "posterUrl");
  try {
    videoUrl = (await upload(fd, "videoFile")) ?? videoUrl;
    posterUrl = (await upload(fd, "posterFile")) ?? posterUrl;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }
  await updateSettings({
    announcement: { enabled: b(fd, "annEnabled"), text: s(fd, "annText"), textAr: s(fd, "annTextAr") },
    hero: {
      title: s(fd, "title"), titleAr: s(fd, "titleAr"), highlight: s(fd, "highlight"), highlightAr: s(fd, "highlightAr"),
      subtitle: s(fd, "subtitle"), subtitleAr: s(fd, "subtitleAr"), videoUrl, posterUrl,
      overlayOpacity: Math.max(0, Math.min(100, n(fd, "overlayOpacity", 60))),
    },
  });
  return done(user, "theme");
}

export async function saveCheckout(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  const codFee = n(fd, "codFee"), codMax = n(fd, "codMax");
  if (codFee < 0 || codMax < 0) return { error: "Fees can't be negative." };
  if (!b(fd, "cardEnabled") && !b(fd, "codEnabled")) return { error: "Enable at least one payment method." };
  await updateSettings({
    checkout: {
      guestCheckout: b(fd, "guestCheckout"), cardEnabled: b(fd, "cardEnabled"), codEnabled: b(fd, "codEnabled"), codFee, codMax,
      orderNotes: b(fd, "orderNotes"), marketingOptIn: b(fd, "marketingOptIn"), bnplMessage: b(fd, "bnplMessage"),
    },
    warranty: { months: n(fd, "warrantyMonths", 12), carePlusPercent: n(fd, "carePlusPercent", 6), carePlusMin: n(fd, "carePlusMin", 29), carePlusMonths: n(fd, "carePlusMonths", 24) },
    returnsDays: n(fd, "returnsDays", 14),
    express: {
      showCountdown: b(fd, "showCountdown"),
      cutoffHour: Math.max(0, Math.min(23, Math.round(n(fd, "cutoffHour", 15)))),
      noDeliveryWeekdays: fd.getAll("noDeliveryWeekdays").map(Number).filter((d) => d >= 0 && d <= 6),
    },
  });
  return done(user, "checkout & payments");
}

export async function saveTaxes(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  const rate = n(fd, "rate", 5);
  if (rate < 0 || rate > 50) return { error: "Enter a valid VAT rate." };
  await updateSettings({ tax: { rate, included: true, label: s(fd, "label") || "VAT" } });
  return done(user, "tax");
}

export async function saveLanguages(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  const def = s(fd, "defaultLocale") === "ar" ? "ar" : "en";
  const arabicEnabled = b(fd, "arabicEnabled");
  await updateSettings({ languages: { arabicEnabled, defaultLocale: arabicEnabled ? def : "en" } });
  return done(user, "language");
}

export async function saveNotifications(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  const cur = (await getSettings()).notifications;
  const next = Object.fromEntries(Object.keys(cur).filter((k) => k !== "staffEmail").map((k) => [k, b(fd, k)]));
  const staffEmail = s(fd, "staffEmail");
  if (staffEmail && !/^\S+@\S+\.\S+$/.test(staffEmail)) return { error: "Enter a valid staff email." };
  await updateSettings({ notifications: { ...cur, ...next, staffEmail } });
  return done(user, "notification");
}

// ───────── Shipping rates ─────────
export async function saveShippingRate(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  const id = s(fd, "id");
  const name = s(fd, "name");
  if (!name) return { error: "Name is required." };
  const price = n(fd, "price", -1);
  if (price < 0) return { error: "Price is required." };
  const emirates = fd.getAll("emirates").map(String).filter((e) => EMIRATES.includes(e));
  const data = {
    name, nameAr: s(fd, "nameAr"), price, emirates: emirates.length === EMIRATES.length ? "" : emirates.join(","),
    freeAbove: s(fd, "freeAbove") ? n(fd, "freeAbove") : null, minOrder: n(fd, "minOrder"), maxOrder: s(fd, "maxOrder") ? n(fd, "maxOrder") : null,
    expressOnly: b(fd, "expressOnly"), deliveryDays: s(fd, "deliveryDays") || "2-4", active: b(fd, "active"), position: n(fd, "position"),
  };
  if (id) await db.shippingRate.update({ where: { id }, data });
  else await db.shippingRate.create({ data });
  await logActivity(user, id ? "updated" : "created", "shipping", `${id ? "Updated" : "Created"} shipping rate "${name}"`);
  revalidatePath("/admin/settings/shipping");
  revalidatePath("/", "layout");
  return { ok: "Shipping rate saved." };
}

export async function deleteShippingRate(fd: FormData) {
  const user = await requirePermission("settings");
  const r = await db.shippingRate.delete({ where: { id: s(fd, "id") } });
  await logActivity(user, "deleted", "shipping", `Deleted shipping rate "${r.name}"`);
  revalidatePath("/admin/settings/shipping");
}

// ───────── Seller-shipment courier window ─────────
export async function saveCarrierWindow(_: FS, fd: FormData): Promise<FS> {
  const user = await requirePermission("settings");
  const min = Math.round(n(fd, "carrierMinDays", 1));
  const max = Math.round(n(fd, "carrierMaxDays", 3));
  if (min < 0 || max < min || max > 30) return { error: "Enter a valid window: minimum 0 or more, maximum at least the minimum (30 at most)." };
  const cur = (await getSettings()).delivery;
  await updateSettings({ delivery: { ...cur, carrierMinDays: min, carrierMaxDays: max } });
  return done(user, "delivery window");
}
