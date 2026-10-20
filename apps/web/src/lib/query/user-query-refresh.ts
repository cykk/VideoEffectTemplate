import type { QueryClient } from "@tanstack/react-query";
import { USER_BOOTSTRAP_QUERY_KEY } from "@/hooks/use-user-bootstrap";
import { USER_CREDITS_QUERY_KEY } from "@/hooks/use-user-credits";

export function refreshUserCredits(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: USER_CREDITS_QUERY_KEY,
    exact: true,
  });
}

export function refreshUserBootstrap(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: USER_BOOTSTRAP_QUERY_KEY,
    exact: true,
  });
}
