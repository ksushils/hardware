import "server-only";
import { db } from "@/lib/db";
export async function pickerProducts() {
  return db.product.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, brand: true, image: true, status: true } });
}
