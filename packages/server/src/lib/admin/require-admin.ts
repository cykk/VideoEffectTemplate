import { headers } from "next/headers";
import { fetchUserBootstrapFromBackend } from "@markless/server/src/lib/server/backend-fetch";

export async function requireAdmin() {
  const requestHeaders = await headers();
  const bootstrap = await fetchUserBootstrapFromBackend(requestHeaders);

  if (!bootstrap.authenticated || !bootstrap.user || !bootstrap.isAdmin) {
    return null;
  }

  return bootstrap.user;
}
