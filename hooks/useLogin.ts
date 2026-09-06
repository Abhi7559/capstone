import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import type { LoginCredentials } from "@/schemas/auth.schema";
import { useAuthStore } from "@/store/useAuthStore";
import type { User } from "@/types/auth";
import { addOrUpdateLocalMember } from "@/utils/localStorageSync";

async function loginRequest(credentials: LoginCredentials): Promise<User> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Invalid email or password");
  }

  return response.json();
}

export function useLogin() {
  const router = useRouter();
  const setLogin = useAuthStore((state) => state.login);

  const mutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      // First attempt NextAuth credentials sign in
      const res = await signIn("credentials", {
        redirect: false,
        email: credentials.email,
        password: credentials.password,
      });

      if (res?.error) {
        return loginRequest(credentials);
      }

      return loginRequest(credentials);
    },
    onSuccess: (user) => {
      setLogin(user);
      if (!user.requiresPasswordChange) {
        router.push("/dashboard?loggedIn=true");
      }
    },
  });

  return {
    login: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
    isSuccess: mutation.isSuccess,
  };
}

async function changePasswordRequest(data: {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<User> {
  const response = await fetch("/api/auth/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to update password");
  }

  return response.json();
}

export function useChangePassword() {
  const setLogin = useAuthStore((state) => state.login);

  const mutation = useMutation({
    mutationFn: changePasswordRequest,
    onSuccess: (user) => {
      setLogin(user);
      addOrUpdateLocalMember(user);
    },
  });

  return {
    changePassword: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error ? (mutation.error as Error).message : null,
  };
}
