import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import type { InviteMemberInput, User } from "@/types/auth";
import { apiEndpoint, getAuthHeaders } from "@/utils/apiConfig";

function extractErrorMessage(errData: any, defaultMsg: string): string {
  if (errData?.message) return errData.message;
  if (typeof errData?.detail === "string") return errData.detail;
  if (Array.isArray(errData?.detail)) {
    return errData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
  }
  return defaultMsg;
}

async function fetchMembers(
  currentUserRole?: string,
  currentUserId?: string,
): Promise<User[]> {
  const headers = getAuthHeaders({
    "x-user-role": currentUserRole || "",
    "x-user-id": currentUserId || "",
  });
  let response = await fetch(apiEndpoint("/members"), { headers });
  if (response.status === 404) {
    response = await fetch(apiEndpoint("/users"), { headers });
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, "Failed to fetch members from server"));
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.items || [];
}

async function inviteMemberRequest(
  input: InviteMemberInput,
  currentUserRole?: string,
  currentUserId?: string,
) {
  const headers = getAuthHeaders({
    "Content-Type": "application/json",
    "x-user-role": currentUserRole || "",
    "x-user-id": currentUserId || "",
  });
  let response = await fetch(apiEndpoint("/members/invite"), {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (response.status === 404) {
    response = await fetch(apiEndpoint("/users/invite"), {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, "Failed to invite member"));
  }

  return response.json();
}

async function updateMemberRequest(
  id: string,
  input: Partial<User>,
  currentUserRole?: string,
  currentUserId?: string,
): Promise<User> {
  const headers = getAuthHeaders({
    "Content-Type": "application/json",
    "x-user-role": currentUserRole || "",
    "x-user-id": currentUserId || "",
  });
  let response = await fetch(apiEndpoint(`/members/${id}`), {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
  });
  if (response.status === 404) {
    response = await fetch(apiEndpoint(`/users/${id}`), {
      method: "PATCH",
      headers,
      body: JSON.stringify(input),
    });
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, "Failed to update member"));
  }

  return response.json();
}

async function deleteMemberRequest(
  id: string,
  currentUserRole?: string,
  currentUserId?: string,
): Promise<{ message: string }> {
  const headers = getAuthHeaders({
    "x-user-role": currentUserRole || "",
    "x-user-id": currentUserId || "",
  });
  let response = await fetch(apiEndpoint(`/members/${id}`), {
    method: "DELETE",
    headers,
  });

  if (response.status === 404) {
    response = await fetch(apiEndpoint(`/users/${id}`), {
      method: "DELETE",
      headers,
    });
  }

  // 204 No Content has no JSON body - treat as immediate success
  if (response.status === 204) {
    return { message: "Member deleted successfully" };
  }

  // 404 means the member was already deleted / not found
  if (response.status === 404) {
    return { message: "Member already removed" };
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(err, "Failed to delete member on server"));
  }

  return response
    .json()
    .catch(() => ({ message: "Member deleted successfully" }));
}

export function useMembers() {
  const currentUser = useAuthStore((state) => state.currentUser);

  const query = useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers(currentUser?.role, currentUser?.id),
    enabled: true,
  });

  useEffect(() => {
    if (query.data && currentUser) {
      const me = query.data.find((m) => m.id === currentUser.id);
      if (
        me &&
        (me.role !== currentUser.role || me.name !== currentUser.name)
      ) {
        useAuthStore.getState().login(me);
      }
    }
  }, [query.data, currentUser]);

  return query;
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: (input: InviteMemberInput) =>
      inviteMemberRequest(input, currentUser?.role, currentUser?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  return {
    inviteMember: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    isSuccess: mutation.isSuccess,
    reset: mutation.reset,
  };
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<User> }) =>
      updateMemberRequest(id, input, currentUser?.role, currentUser?.id),
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      queryClient.invalidateQueries({ queryKey: ["projectTasks"] });

      if (updatedUser && currentUser && updatedUser.id === currentUser.id) {
        useAuthStore.getState().login(updatedUser);
      }
    },
  });

  return {
    updateMember: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: (id: string) =>
      deleteMemberRequest(id, currentUser?.role, currentUser?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  return {
    deleteMember: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}
