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

    const { password: _, ...safeMember } = newMember;

    return {
      member: safeMember,
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

    const updated = userRepository.update(id, updates);
    if (!updated) {
      throw new Error("Member not found");
    }
    return updated;
  },

  deleteMember(id: string, currentUserRole?: string): boolean {
    if (currentUserRole !== "admin") {
      throw new Error("Forbidden: Admin privileges required to delete members");
    }

    const deleted = userRepository.delete(id);
    if (!deleted) {
      throw new Error("Member not found");
    }
    return true;
  },
};
