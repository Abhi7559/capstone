import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import type { InviteMemberInput, User } from "@/types/auth";
import {
  addOrUpdateLocalMember,
  getLocalMembers,
  mergeMembersWithLocal,
  removeLocalMember,
} from "@/utils/localStorageSync";

async function fetchMembers(currentUserRole?: string): Promise<User[]> {
  try {
    const response = await fetch("/api/members", {
      headers: {
        "x-user-role": currentUserRole || "",
      },
    });

    if (response.ok) {
      const data: User[] = await response.json();
      return mergeMembersWithLocal(data);
    }
  } catch (err) {
    console.warn("API members fetch failed, falling back to local storage", err);
  }

  return getLocalMembers();
}

async function inviteMemberRequest(
  input: InviteMemberInput,
  currentUserRole?: string,
) {
  const response = await fetch("/api/members/invite", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": currentUserRole || "",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to invite member");
  }

  const result = await response.json();
  if (result.member) {
    addOrUpdateLocalMember(result.member);
  }
  return result;
}

async function updateMemberRequest(
  id: string,
  input: Partial<User>,
  currentUserRole?: string,
): Promise<User> {
  const response = await fetch(`/api/members/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": currentUserRole || "",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to update member");
  }

  const updated: User = await response.json();
  addOrUpdateLocalMember(updated);
  return updated;
}

async function deleteMemberRequest(
  id: string,
  currentUserRole?: string,
): Promise<{ message: string }> {
  const response = await fetch(`/api/members/${id}`, {
    method: "DELETE",
    headers: {
      "x-user-role": currentUserRole || "",
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to delete member");
  }

  removeLocalMember(id);
  return response.json();
}

export function useMembers() {
  const currentUser = useAuthStore((state) => state.currentUser);

  return useQuery({
    queryKey: ["members"],
    queryFn: () => fetchMembers(currentUser?.role || "admin"),
    enabled: true,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);

  const mutation = useMutation({
    mutationFn: (input: InviteMemberInput) =>
      inviteMemberRequest(input, currentUser?.role || "admin"),
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
      updateMemberRequest(id, input, currentUser?.role || "admin"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
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
      deleteMemberRequest(id, currentUser?.role || "admin"),
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
