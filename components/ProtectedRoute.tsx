import { useRouter } from "next/router";
import { type ReactNode, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ("admin" | "member")[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { isAuthenticated, currentUser, isHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (
      allowedRoles &&
      currentUser &&
      !allowedRoles.includes(currentUser.role)
    ) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, currentUser, isHydrated, router, allowedRoles]);

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500 font-medium">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
