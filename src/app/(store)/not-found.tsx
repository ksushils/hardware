import Link from "next/link";
import { getI18n } from "@/lib/i18n";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="container-x py-24 text-center">
      <p className="text-6xl font-black text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-bold">{t.notFound.title}</h1>
      <form action="/search" className="mx-auto mt-6 flex max-w-md gap-2"><input name="q" className="input" placeholder={t.common.searchPlaceholder} aria-label={t.common.search} /><button className="btn-dark">{t.common.search}</button></form>
      <Link href="/" className="btn-primary mt-6">{t.common.backHome}</Link>
    </div>
  );
}
