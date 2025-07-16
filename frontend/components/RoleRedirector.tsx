"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export function RoleRedirector() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!isLoaded) return;
    const role = user?.publicMetadata?.role;
    const isOnRoleOrProfilePage =
      pathname?.startsWith("/role-selection") ||
      pathname?.startsWith("/candidate-profile-setup") ||
      pathname?.startsWith("/recruiter-profile-setup");
    if (!role && !isOnRoleOrProfilePage) {
      router.replace("/role-selection");
    }
  }, [user, isLoaded, router, pathname]);
  return null;
} 