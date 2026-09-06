import type { Project } from "@/types/project";
import { db } from "../database/db";

export const projectRepository = {
  findAll(): Project[] {
    return db.getProjects();
  },

  findById(id: string): Project | undefined {
    return db.findProjectById(id);
  },

  findByMemberId(memberId: string): Project[] {
    return db.getProjects().filter((p) => p.memberIds.includes(memberId));
  },

  create(project: Project): Project {
    return db.addProject(project);
  },

  update(id: string, updatedFields: Partial<Project>): Project | undefined {
    return db.updateProject(id, updatedFields);
  },

  delete(id: string): boolean {
    return db.deleteProject(id);
  },
};
