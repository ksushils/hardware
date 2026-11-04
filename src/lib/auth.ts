import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { hasPermission, isStaff, type Permission } from "./permissions";

const COOKIE = "tr_session";
const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me-please-0123456789");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30d").sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = { id: string; email: string; name: string; phone: string | null; role: string; permissions: string; locale: string };

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    const u = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, phone: true, role: true, permissions: true, locale: true, disabled: true },
    });
    if (!u || u.disabled) return null;
    const { disabled: _d, ...rest } = u;
    return rest;
  } catch {
    return null;
  }
}

export async function requireUser(next = "/account") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

/** Any staff member (ADMIN or STAFF). */
export async function requireStaff() {
  const user = await getUser();
  if (!user) redirect("/login?next=/admin");
  if (!isStaff(user)) redirect("/");
  return user;
}

/** Staff member with a specific permission. Use in admin pages AND server actions. */
export async function requirePermission(perm: Permission) {
  const user = await requireStaff();
  if (!hasPermission(user, perm)) redirect("/admin?denied=" + perm);
  return user;
}

/** @deprecated use requirePermission */
export async function requireAdmin() {
  return requireStaff();
}
