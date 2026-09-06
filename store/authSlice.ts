import type { StateCreator } from "zustand";
import type { User } from "@/types/auth";

export interface AuthSlice {
  currentUser: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: User) => void;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
}

const DEFAULT_ADMIN: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "System Admin",
  email: "admin@teamboard.com",
  role: "admin",
  status: "active",
};

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  currentUser: DEFAULT_ADMIN,
  isAuthenticated: true,
  isHydrated: false,
  login: (user: User) => {
    const { password: _, ...safeUser } = user;
    set({ currentUser: safeUser as User, isAuthenticated: true });
  },
  logout: () => {
    set({ currentUser: null, isAuthenticated: false });
  },
  setHydrated: (hydrated: boolean) => set({ isHydrated: hydrated }),
});
