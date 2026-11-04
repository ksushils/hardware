import Link from "next/link";
import { getI18n } from "@/lib/i18n";
import { consumeResetToken } from "@/lib/passwordReset";
import { ResetForm } from "@/components/AuthForms";

export const metadata = { title: "Choose a new password", robots: { index: false } };
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getI18n();
  const valid = await consumeResetToken(token);
  return (
    <div className="container-x max-w-md py-14">
      <div className="card p-8">
        <h1 className="mb-6 text-2xl font-black">{t.auth.resetTitle}</h1>
        {valid ? <ResetForm token={token} /> : <p className="text-sm text-red-600">{t.auth.resetInvalid} <Link href="/forgot-password" className="underline">{t.auth.forgot}</Link></p>}
      </div>
    </div>
  );
}
