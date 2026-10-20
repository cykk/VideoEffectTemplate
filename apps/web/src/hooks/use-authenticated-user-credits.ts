"use client";

import { useUserBootstrap } from "@/hooks/use-user-bootstrap";
import { useUserCredits } from "@/hooks/use-user-credits";

export function useAuthenticatedUserCredits() {
  const { data: bootstrap, loading: bootstrapLoading } = useUserBootstrap();
  const isAuthenticated = bootstrap?.authenticated ?? false;
  const canSeedCreditsFromBootstrap =
    bootstrap?.authenticated === true && bootstrap.creditsBreakdown !== null;
  const creditsQuery = useUserCredits({
    enabled: isAuthenticated,
    initialData: canSeedCreditsFromBootstrap
      ? {
          credits: bootstrap.credits,
          creditsBreakdown: bootstrap.creditsBreakdown,
        }
      : null,
  });

  return {
    bootstrap,
    bootstrapLoading,
    isAuthenticated,
    creditsData: creditsQuery.data,
    creditsLoading: creditsQuery.loading,
    creditsError: creditsQuery.error,
    reloadCredits: creditsQuery.reload,
  };
}
