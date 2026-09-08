import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  AdminDashboardData,
  MemberDashboardData,
} from "@/types/dashboard";

async function fetchDashboardData(
  userRole?: string,
  userId?: string,
): Promise<AdminDashboardData | MemberDashboardData> {
  const role = userRole || "admin";
  const id = userId || "550e8400-e29b-41d4-a716-446655440000";

  const response = await fetch("/api/dashboard/stats", {
    headers: {
      "x-user-role": role,
      "x-user-id": id,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard stats from server");
  }

  return response.json();
}

export function useDashboardData() {
  const currentUser = useAuthStore((state) => state.currentUser);

  return useQuery<AdminDashboardData | MemberDashboardData, Error>({
    queryKey: ["dashboardData", currentUser?.id, currentUser?.role],
    queryFn: () => fetchDashboardData(currentUser?.role, currentUser?.id),
    enabled: Boolean(currentUser),
  });
}
