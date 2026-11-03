import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { RegisterForm } from "@/components/AuthForms";
export const metadata = { title: "Create account" };
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) redirect(next || "/account");
  return (
    <div className="container-x max-w-md py-14">
      <div className="card p-8">
        <h1 className="text-2xl font-black">Create your account</h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">Get faster checkout and exclusive member deals.</p>
        <RegisterForm next={next} />
      </div>
    </div>
  );
}
