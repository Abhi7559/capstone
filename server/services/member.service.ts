import type {
  InviteMemberInput,
  InviteMemberResponse,
  User,
} from "@/types/auth";
import { userRepository } from "../repositories/user.repository";

function generateTempPassword(): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export const memberServiceServer = {
  getMembers(currentUserRole?: string): User[] {
    if (currentUserRole !== "admin") {
      throw new Error("Forbidden: Admin privileges required to view members");
    }

    return userRepository.findAll();
  },

  inviteMember(
    input: InviteMemberInput,
    currentUserRole?: string,
  ): InviteMemberResponse {
    if (currentUserRole !== "admin") {
      throw new Error("Forbidden: Admin privileges required to invite members");
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const exists = userRepository.findByEmail(normalizedEmail);

    if (exists) {
      throw new Error("A user with this email already exists.");
    }

    const tempPassword = generateTempPassword();
    const newMember: User = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      email: normalizedEmail,
      role: "member",
      status: "active",
      password: tempPassword,
      designation: input.designation?.trim() || "Software Engineer",
      joiningDate: input.joiningDate || new Date().toISOString().split("T")[0],
      requiresPasswordChange: true,
    };

    userRepository.create(newMember);

    return {
      member: newMember,
      temporaryPassword: tempPassword,
    };
  },

  updateMember(
    id: string,
    updates: Partial<User>,
    currentUserRole?: string,
  ): User {
    if (currentUserRole !== "admin") {
      throw new Error("Forbidden: Admin privileges required to update members");
    }

    const existing = userRepository.findById(id);
    if (!existing) {
      throw new Error("Member not found");
    }

    if (updates.role === "member" && existing.role === "admin") {
      const adminCount = userRepository
        .findAll()
        .filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error(
          "Cannot demote the only remaining Admin. The workspace must have at least one Admin.",
        );
      }
    }

    const updated = userRepository.update(id, updates);
    if (!updated) {
      throw new Error("Member not found");
    }
    return updated;
  },

  deleteMember(id: string, currentUserRole?: string): boolean {
    const isAdmin =
      !currentUserRole || currentUserRole.toLowerCase() === "admin";
    if (!isAdmin) {
      throw new Error("Forbidden: Admin privileges required to delete members");
    }

    const existing = userRepository.findById(id);
    if (existing?.role === "admin") {
      const adminCount = userRepository
        .findAll()
        .filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        throw new Error(
          "Cannot delete the only remaining Admin. The workspace must have at least one Admin.",
        );
      }
    }

    userRepository.delete(id);
    return true;
  },
};
