import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n";
import { RegisterForm } from "@/components/AuthForms";

export const metadata = { title: "Create account", robots: { index: false } };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t } = await getI18n();
  if (await getUser()) redirect(next || "/account");
  return (
    <div className="container-x max-w-md py-14">
      <div className="card p-8">
        <h1 className="text-2xl font-black">{t.auth.createTitle}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">{t.auth.createSub}</p>
        <RegisterForm next={next} />
      </div>
    </div>
  );
}
