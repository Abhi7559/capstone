import type { User } from "@/types/auth";
import { db } from "../database/db";

export const userRepository = {
  findAll(): User[] {
    return db.getUsers();
  },

  findByEmail(email: string): User | undefined {
    return db.findUserByEmail(email);
  },

  create(user: User): User {
    return db.addUser(user);
  },

  updatePassword(email: string, newPassword: string): boolean {
    return db.updateUserPassword(email, newPassword);
  },

  update(id: string, updates: Partial<User>): User | undefined {
    return db.updateUser(id, updates);
  },

  delete(id: string): boolean {
    return db.deleteUser(id);
  },
};
