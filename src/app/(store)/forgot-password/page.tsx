import { getI18n } from "@/lib/i18n";
import { ForgotForm } from "@/components/AuthForms";

export const metadata = { title: "Reset password", robots: { index: false } };
export default async function ForgotPage() {
  const { t } = await getI18n();
  return (
    <div className="container-x max-w-md py-14">
      <div className="card p-8">
        <h1 className="text-2xl font-black">{t.auth.forgotTitle}</h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">{t.auth.forgotSub}</p>
        <ForgotForm />
      </div>
    </div>
  );
}
