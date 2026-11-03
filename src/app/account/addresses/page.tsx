import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { deleteAddress, setDefaultAddress } from "@/app/actions/account";
import AddressForm from "@/components/AddressForm";

export const metadata = { title: "Addresses" };

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses");
  const addresses = await db.address.findMany({ where: { userId: user.id }, orderBy: { isDefault: "desc" } });
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <div key={a.id} className="card p-5 text-sm">
            <div className="flex justify-between"><p className="font-semibold">{a.fullName}</p>{a.isDefault && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">Default</span>}</div>
            <p className="mt-1 text-slate-600">{a.building}, {a.street}<br />{a.area}, {a.emirate}<br />{a.phone}</p>
            <div className="mt-3 flex gap-4">
              {!a.isDefault && <form action={setDefaultAddress}><input type="hidden" name="id" value={a.id} /><button className="font-semibold text-brand-700">Set default</button></form>}
              <form action={deleteAddress}><input type="hidden" name="id" value={a.id} /><button className="text-red-600">Delete</button></form>
            </div>
          </div>
        ))}
        {addresses.length === 0 && <p className="text-sm text-slate-500">No saved addresses.</p>}
      </div>
      <AddressForm />
    </div>
  );
}
