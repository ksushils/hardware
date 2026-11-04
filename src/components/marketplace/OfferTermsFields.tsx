"use client";
import { useState } from "react";
import { CONDITION_TYPES, CONDITION_TYPE_LABEL } from "@/lib/offers";

import { type OfferTermsInitial } from "@/lib/offerTermsInitial";
export type { OfferTermsInitial };

/**
 * Condition, evidence, warranty, returns and unit photos for an offer (inputs only; the parent form supplies the <form>).
 * Shared by the "add offer" form and the "create new product" form.
 */
export default function OfferTermsFields({ initial, minReturnDays }: { initial: OfferTermsInitial; minReturnDays: number }) {
  const [photos, setPhotos] = useState(initial.photos);
  const [type, setType] = useState(initial.conditionType);
  return (
    <div className="space-y-5">
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Condition & evidence</h2>
        <p className="mb-3 text-xs text-slate-500">Be accurate: buyers see exactly what you enter, labelled “Seller-declared”. Only the marketplace team can mark evidence as verified. Leave a field empty if you can&apos;t supply it. It will show as “Not supplied”.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label><span className="label">Commercial condition *</span>
            <select name="conditionType" value={type} onChange={(e) => setType(e.target.value)} className="in-a">{CONDITION_TYPES.map((c) => <option key={c} value={c}>{CONDITION_TYPE_LABEL[c][0]}</option>)}</select>
          </label>
          <label><span className="label">Cosmetic grade {type !== "NEW" && "*"}</span><input name="cosmeticGrade" defaultValue={initial.cosmeticGrade} placeholder="Excellent / Very good / Good" className="in-a" /></label>
          <label><span className="label">Functional status {type !== "NEW" && "*"}</span><input name="functionalStatus" defaultValue={initial.functionalStatus} placeholder="e.g. Fully tested, all functions work" className="in-a" /></label>
          <label><span className="label">Battery health (%)</span><input name="batteryHealth" type="number" min={0} max={100} defaultValue={initial.batteryHealth} className="in-a" /></label>
          <label><span className="label">Battery cycles</span><input name="batteryCycles" type="number" min={0} defaultValue={initial.batteryCycles} className="in-a" /></label>
          <label><span className="label">Included accessories</span><input name="accessories" defaultValue={initial.accessories} placeholder="Charger, box, cables…" className="in-a" /></label>
          <label className="md:col-span-3"><span className="label">Repairs & replaced parts</span><textarea name="repairDisclosure" defaultValue={initial.repairDisclosure} rows={2} placeholder="e.g. Thermal paste replaced; no other repairs. Write “None” if there are none." className="in-a" /></label>
          <label><span className="label">Tested on</span><input name="testedAt" type="date" defaultValue={initial.testedAt} className="in-a" /></label>
          <label><span className="label">Tested by</span><input name="testedBy" defaultValue={initial.testedBy} placeholder="Technician / company" className="in-a" /></label>
          <label><span className="label">Test notes</span><input name="testNotes" defaultValue={initial.testNotes} placeholder="Tools, results, stress-test duration…" className="in-a" /></label>
        </div>
        <label className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm">
          <input type="checkbox" name="declare" defaultChecked={initial.declared} className="mt-0.5" />
          <span>I declare that the condition and test details above are accurate for the unit(s) I am selling. {initial.verification === "PLATFORM_VERIFIED" && <b className="text-emerald-700">(Currently verified by TechRevive. Changing these details removes the verification.)</b>}</span>
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">Photos of this exact unit</h2>
        <p className="mb-3 text-xs text-slate-500">For used and refurbished items, upload real photos of the unit you&apos;ll ship (front, back, any marks). They appear first on the product page captioned “Photos of this exact unit”. Up to 8.</p>
        <div className="flex flex-wrap gap-3">
          {photos.map((u, i) => (
            <div key={u + i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-24 w-24 rounded-lg border bg-slate-50 object-cover" />
              <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="mt-1 block w-full text-center text-xs text-red-600">Remove</button>
            </div>
          ))}
        </div>
        <input type="file" name="newPhotos" accept="image/*" multiple className="mt-3 text-sm" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">Warranty, returns & dispatch</h2>
        <p className="mb-3 text-xs text-slate-500">Buyers get these exact terms saved with their order. You can&apos;t shorten the marketplace return window ({minReturnDays} days) or remove statutory consumer rights. Never describe your own warranty as the manufacturer&apos;s.</p>
        <div className="grid gap-3 md:grid-cols-4">
          <label><span className="label">Warranty provided by</span>
            <select name="warrantyProvider" defaultValue={initial.warrantyProvider} className="in-a"><option value="SELLER">Seller</option><option value="MANUFACTURER">Manufacturer</option><option value="NONE">No warranty</option></select>
          </label>
          <label><span className="label">Warranty (months)</span><input name="warrantyMonths" type="number" min={0} max={60} defaultValue={initial.warrantyMonths} className="in-a" /></label>
          <label><span className="label">Return window (days)</span><input name="returnDays" type="number" min={minReturnDays} max={90} defaultValue={initial.returnDays} placeholder={`${minReturnDays} (standard)`} className="in-a" /></label>
          <label><span className="label">Dispatch within (business days)</span><input name="handlingDays" type="number" min={0} max={14} defaultValue={initial.handlingDays} className="in-a" /></label>
          <label className="md:col-span-2"><span className="label">Warranty terms (covered, exclusions, how to claim)</span><textarea name="warrantyTerms" defaultValue={initial.warrantyTerms} rows={2} className="in-a" /></label>
          <label className="md:col-span-2"><span className="label">Extra return terms (optional)</span><textarea name="returnTerms" defaultValue={initial.returnTerms} rows={2} className="in-a" /></label>
        </div>
      </section>
    </div>
  );
}
