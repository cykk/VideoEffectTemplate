"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@markless/shared/src/lib/auth/client";
import {
    SIGNED_OUT_BOOTSTRAP,
    USER_BOOTSTRAP_QUERY_KEY,
} from "@/hooks/use-user-bootstrap";
import { USER_CREDITS_QUERY_KEY } from "@/hooks/use-user-credits";

type SignOutOptions = {
    redirectTo?: string;
    hardRedirect?: boolean;
};

export function useSignOut() {
    const router = useRouter();
    const queryClient = useQueryClient();

    return useCallback(
        async ({ redirectTo, hardRedirect = false }: SignOutOptions = {}) => {
            await authClient.signOut();

            if (typeof window !== "undefined") {
                localStorage.removeItem("oauth-callback-target");
            }

            await Promise.all([
                queryClient.cancelQueries({ queryKey: USER_BOOTSTRAP_QUERY_KEY, exact: true }),
                queryClient.cancelQueries({ queryKey: USER_CREDITS_QUERY_KEY, exact: true }),
            ]);

            queryClient.setQueryData(USER_BOOTSTRAP_QUERY_KEY, SIGNED_OUT_BOOTSTRAP);
            queryClient.removeQueries({ queryKey: USER_CREDITS_QUERY_KEY, exact: true });

            if (redirectTo) {
                if (hardRedirect) {
                    window.location.href = redirectTo;
                    return;
                }

                router.replace(redirectTo);
            }

            router.refresh();
        },
        [queryClient, router],
    );
}
