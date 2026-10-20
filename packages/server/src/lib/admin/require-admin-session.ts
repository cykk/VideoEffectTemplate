import { auth } from "@markless/server/src/lib/auth/server";
import { db } from "@markless/server/src/lib/db";
import { users } from "@markless/server/src/lib/db/schema/users";
import { eq } from "drizzle-orm";

export async function requireAdminSession(requestHeaders: Headers) {
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      id: true,
      email: true,
      role: true,
    },
  });

  if (!user || user.role !== "admin") {
    return null;
  }

  return {
    session,
    user,
  };
}
