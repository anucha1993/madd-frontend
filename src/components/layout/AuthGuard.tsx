"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser, removeAuth, updateStoredUser, type AuthUser } from "@/lib/auth";
import { ApiError, apiClient } from "@/lib/apiClient";
import { NO_ACCESS, type Access } from "@/lib/access";
import { AccessProvider } from "@/components/auth/AccessProvider";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    // Always re-read /me on load so Role/permission changes made by an admin apply on the next
    // page load, not only after re-login. Falls back to the cached copy if the call fails for
    // any reason other than an expired/invalid token.
    apiClient
      .get<AuthUser>("/me")
      .then((user) => {
        updateStoredUser(user);
        setAccess(user.access ?? NO_ACCESS);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          removeAuth();
          router.replace("/login");
          return;
        }
        setAccess(getUser()?.access ?? NO_ACCESS);
      });
  }, [router]);

  if (!access) return null;

  return <AccessProvider access={access}>{children}</AccessProvider>;
}
