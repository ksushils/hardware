"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";

/** Background video that respects prefers-reduced-motion and has a pause control (WCAG 2.2.2). */
export default function HeroVideo({ src, poster, overlay }: { src: string; poster: string; overlay: number }) {
  const { t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) { setReduced(true); setPlaying(false); ref.current?.pause(); }
  }, []);
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); }
  };
  const webm = src.endsWith(".mp4") ? src.replace(/\.mp4$/, ".webm") : null;
  return (
    <>
      <video ref={ref} className="absolute inset-0 h-full w-full object-cover" autoPlay={!reduced} muted loop playsInline preload="metadata" poster={poster} aria-hidden>
        {webm && src.startsWith("/video/") && <source src={webm} type="video/webm" />}
        <source src={src} type={src.endsWith(".webm") ? "video/webm" : "video/mp4"} />
      </video>
      <div className="absolute inset-0 bg-gradient-to-r from-ink-900 via-ink-900/80 to-ink-900/30 rtl:bg-gradient-to-l" style={{ opacity: Math.min(1, Math.max(0.2, overlay / 100 + 0.3)) }} />
      <button type="button" onClick={toggle} className="absolute bottom-4 end-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25" aria-label={playing ? t.home.pauseVideo : t.home.playVideo}>
        {playing ? "❚❚" : "▶"}
      </button>
    </>
  );
}
