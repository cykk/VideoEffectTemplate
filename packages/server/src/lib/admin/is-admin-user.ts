import { eq } from "drizzle-orm";
import { db } from "@markless/server/src/lib/db";
import { users } from "@markless/server/src/lib/db/schema/users";

export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { role: true },
  });

  return user?.role === "admin";
}
