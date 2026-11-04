import { requirePermission } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Card, Field, PageHeader } from "@/components/admin/ui";
import FormShell from "@/components/admin/store/FormShell";
import HeroPreview from "@/components/admin/store/HeroPreview";
import { Grid, Toggle } from "@/components/admin/store/inputs";
import { saveTheme } from "@/app/actions/admin/settings";

export const metadata = { title: "Theme & homepage" };

export default async function ThemeSettings() {
  await requirePermission("settings");
  const s = await getSettings();
  const h = s.hero;
  return (
    <div>
      <PageHeader title="Theme & homepage" back="/admin/settings" actions={<a href="/" target="_blank" className="btn-a">View store ↗</a>} />
      <FormShell action={saveTheme}>
        <span id="theme-form" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <Card title="Announcement bar">
              <Toggle name="annEnabled" label="Show announcement bar" defaultChecked={s.announcement.enabled} />
              <Grid>
                <Field label="Text"><input name="annText" defaultValue={s.announcement.text} className="in-a" /></Field>
                <Field label="Text (Arabic)"><input name="annTextAr" dir="rtl" defaultValue={s.announcement.textAr} className="in-a" /></Field>
              </Grid>
            </Card>
            <Card title="Hero section">
              <div className="space-y-4">
                <Grid>
                  <Field label="Heading"><input name="title" defaultValue={h.title} className="in-a" /></Field>
                  <Field label="Heading (Arabic)"><input name="titleAr" dir="rtl" defaultValue={h.titleAr} className="in-a" /></Field>
                  <Field label="Highlighted line"><input name="highlight" defaultValue={h.highlight} className="in-a" /></Field>
                  <Field label="Highlighted line (Arabic)"><input name="highlightAr" dir="rtl" defaultValue={h.highlightAr} className="in-a" /></Field>
                  <Field label="Subheading"><textarea name="subtitle" rows={3} defaultValue={h.subtitle} className="in-a" /></Field>
                  <Field label="Subheading (Arabic)"><textarea name="subtitleAr" dir="rtl" rows={3} defaultValue={h.subtitleAr} className="in-a" /></Field>
                </Grid>
              </div>
            </Card>
            <Card title="Background video">
              <div className="space-y-4">
                <Grid>
                  <Field label="Video URL" help="MP4 or WebM, muted & looped. Keep it under ~8MB for fast loading."><input name="videoUrl" defaultValue={h.videoUrl} className="in-a font-mono text-xs" /></Field>
                  <Field label="…or upload a video"><input type="file" name="videoFile" accept="video/mp4,video/webm" className="text-sm" /></Field>
                  <Field label="Poster image URL" help="Shown while the video loads and on data-saver connections"><input name="posterUrl" defaultValue={h.posterUrl} className="in-a font-mono text-xs" /></Field>
                  <Field label="…or upload a poster"><input type="file" name="posterFile" accept="image/*" className="text-sm" /></Field>
                </Grid>
                <Field label={`Dark overlay: keeps text readable (current ${h.overlayOpacity}%)`}><input type="range" name="overlayOpacity" min={0} max={90} step={5} defaultValue={h.overlayOpacity} className="w-full accent-slate-900" /></Field>
              </div>
            </Card>
          </div>
          <div className="lg:sticky lg:top-16 lg:self-start"><HeroPreview formId="theme-form" /></div>
        </div>
      </FormShell>
    </div>
  );
}
