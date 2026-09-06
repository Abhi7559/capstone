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
  const response = await fetch("/api/dashboard/stats", {
    headers: {
      "x-user-role": userRole || "",
      "x-user-id": userId || "",
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to fetch dashboard data");
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
