import "server-only";
import { db } from "./db";

export async function logActivity(
  user: { id: string; name: string } | null,
  action: string,
  entityType: string,
  message: string,
  entityId?: string,
) {
  try {
    await db.activityLog.create({ data: { userId: user?.id, userName: user?.name, action, entityType, entityId, message } });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

export async function orderEvent(orderId: string, type: string, message: string, userId?: string) {
  await db.orderEvent.create({ data: { orderId, type, message, userId } });
}
