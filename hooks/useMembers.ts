import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import type { InviteMemberInput, User } from "@/types/auth";

async function fetchMembers(
  currentUserRole?: string,
  currentUserId?: string,
): Promise<User[]> {
  const response = await fetch("/api/members", {
    headers: {
      "x-user-role": currentUserRole || "",
      "x-user-id": currentUserId || "",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch members from server");
  }

  return response.json();
}

async function inviteMemberRequest(
  input: InviteMemberInput,
  currentUserRole?: string,
  currentUserId?: string,
) {
  const response = await fetch("/api/members/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": currentUserRole || "",
      "x-user-id": currentUserId || "",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to invite member");
  }

  return response.json();
}

async function updateMemberRequest(
  id: string,
  input: Partial<User>,
  currentUserRole?: string,
  currentUserId?: string,
): Promise<User> {
  const response = await fetch(`/api/members/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": currentUserRole || "",
      "x-user-id": currentUserId || "",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to update member");
  }

  return response.json();
}

async function deleteMemberRequest(
  id: string,
  currentUserRole?: string,
  currentUserId?: string,
): Promise<{ message: string }> {
  const response = await fetch(`/api/members/${id}`, {
    method: "DELETE",
    headers: {
      "x-user-role": currentUserRole || "",
      "x-user-id": currentUserId || "",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || "Failed to delete member on server");
  }

  return response.json();
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
