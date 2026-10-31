import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  AdminDashboardData,
  MemberDashboardData,
} from "@/types/dashboard";
import { apiEndpoint, getAuthHeaders } from "@/utils/apiConfig";

async function fetchDashboardData(
  userRole?: string,
  userId?: string,
): Promise<AdminDashboardData | MemberDashboardData> {
  const role = userRole || "";
  const id = userId || "";

  const response = await fetch(apiEndpoint("/dashboard/stats"), {
    headers: getAuthHeaders({
      "x-user-role": role,
      "x-user-id": id,
    }),
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
