export type UserRole = "admin" | "member";
export type MemberStatus = "active" | "invited";

export interface User {
  id: string; // UUID string
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  status?: MemberStatus;
  designation?: string;
  joiningDate?: string;
  requiresPasswordChange?: boolean;
}

export interface AuthState {
  currentUser: User | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  login: (user: User) => void;
  logout: () => void;
  setHydrated: (hydrated: boolean) => void;
}

export interface InviteMemberInput {
  name: string;
  email: string;
  designation?: string;
  joiningDate?: string;
}

export interface InviteMemberResponse {
  member: User;
  temporaryPassword: string;
}
