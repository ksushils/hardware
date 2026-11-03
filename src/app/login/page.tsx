import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LoginForm } from "@/components/AuthForms";
export const metadata = { title: "Sign in" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getUser()) redirect(next || "/account");
  return (
    <div className="container-x max-w-md py-14">
      <div className="card p-8">
        <h1 className="text-2xl font-black">Welcome back</h1>
        <p className="mb-6 mt-1 text-sm text-slate-600">Sign in to track orders, save addresses and your wishlist.</p>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
