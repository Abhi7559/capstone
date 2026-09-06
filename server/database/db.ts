import fs from "node:fs";
import path from "node:path";
import type { User } from "@/types/auth";
import type { ActivityItem } from "@/types/dashboard";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";
import {
  INITIAL_ACTIVITY,
  INITIAL_PROJECTS,
  INITIAL_TASKS,
  INITIAL_USERS,
} from "../database/seed";

const DB_FILE_PATH = process.env.VERCEL
  ? path.join("/tmp", "db.json")
  : path.join(process.cwd(), "data", "db.json");

interface DbSchema {
  users: User[];
  projects: Project[];
  tasks: Task[];
  activity: ActivityItem[];
}

// Persistent database writing to data/db.json
class PersistentDatabase {
  private users: User[] = [];
  private projects: Project[] = [];
  private tasks: Task[] = [];
  private activity: ActivityItem[] = [];

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (fs.existsSync(DB_FILE_PATH)) {
        const fileData = fs.readFileSync(DB_FILE_PATH, "utf-8");
        const parsed: DbSchema = JSON.parse(fileData);
        this.users = parsed.users || [...INITIAL_USERS];
        this.projects = parsed.projects || [...INITIAL_PROJECTS];
        this.tasks = parsed.tasks || [...INITIAL_TASKS];
        this.activity = parsed.activity || [...INITIAL_ACTIVITY];
      } else {
        const seedPath = path.join(process.cwd(), "data", "db.json");
        if (fs.existsSync(seedPath)) {
          const fileData = fs.readFileSync(seedPath, "utf-8");
          const parsed: DbSchema = JSON.parse(fileData);
          this.users = parsed.users || [...INITIAL_USERS];
          this.projects = parsed.projects || [...INITIAL_PROJECTS];
          this.tasks = parsed.tasks || [...INITIAL_TASKS];
          this.activity = parsed.activity || [...INITIAL_ACTIVITY];
        } else {
          this.users = [...INITIAL_USERS];
          this.projects = [...INITIAL_PROJECTS];
          this.tasks = [...INITIAL_TASKS];
          this.activity = [...INITIAL_ACTIVITY];
        }
        this.saveToDisk();
      }
    } catch {
      this.users = [...INITIAL_USERS];
      this.projects = [...INITIAL_PROJECTS];
      this.tasks = [...INITIAL_TASKS];
      this.activity = [...INITIAL_ACTIVITY];
    }
  }

  private saveToDisk(): void {
    try {
      const dir = path.dirname(DB_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const dataToSave: DbSchema = {
        users: this.users,
        projects: this.projects,
        tasks: this.tasks,
        activity: this.activity,
      };
      fs.writeFileSync(
        DB_FILE_PATH,
        JSON.stringify(dataToSave, null, 2),
        "utf-8",
      );
    } catch (err) {
      console.error("Failed to save DB state to disk:", err);
    }
  }

  // User Operations
  getUsers(): User[] {
    this.loadFromDisk();
    return this.users;
  }

  findUserByEmail(email: string): User | undefined {
    this.loadFromDisk();
    const normalized = email.trim().toLowerCase();
    return this.users.find((u) => u.email.toLowerCase() === normalized);
  }

  addUser(user: User): User {
    this.loadFromDisk();
    this.users.push(user);
    this.saveToDisk();
    return user;
  }

  updateUserPassword(email: string, newPassword: string): boolean {
    this.loadFromDisk();
    const normalized = email.trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalized);
    if (user) {
      user.password = newPassword;
      this.saveToDisk();
      return true;
    }
    return false;
  }

  updateUser(id: string, updatedFields: Partial<User>): User | undefined {
    this.loadFromDisk();
    const index = this.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.users[index] = { ...this.users[index], ...updatedFields };
      this.saveToDisk();
      return this.users[index];
    }
    return undefined;
  }

  deleteUser(id: string): boolean {
    this.loadFromDisk();
    const index = this.users.findIndex((u) => u.id === id);
    if (index !== -1) {
      this.users.splice(index, 1);
      for (const p of this.projects) {
        if (p.memberIds) {
          p.memberIds = p.memberIds.filter((mId) => mId !== id);
        }
      }
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Project Operations
  getProjects(): Project[] {
    this.loadFromDisk();
    return this.projects;
  }

  findProjectById(id: string): Project | undefined {
    this.loadFromDisk();
    return this.projects.find((p) => p.id === id);
  }

  addProject(project: Project): Project {
    this.loadFromDisk();
    this.projects.unshift(project);
    this.saveToDisk();
    return project;
  }

  updateProject(
    id: string,
    updatedFields: Partial<Project>,
  ): Project | undefined {
    this.loadFromDisk();
    const index = this.projects.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.projects[index] = { ...this.projects[index], ...updatedFields };
      this.saveToDisk();
      return this.projects[index];
    }
    return undefined;
  }

  deleteProject(id: string): boolean {
    this.loadFromDisk();
    const index = this.projects.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.projects.splice(index, 1);
      this.tasks = this.tasks.filter((t) => t.projectId !== id);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Task Operations
  getTasks(): Task[] {
    this.loadFromDisk();
    return this.tasks;
  }

  findTaskById(id: string): Task | undefined {
    this.loadFromDisk();
    return this.tasks.find((t) => t.id === id);
  }

  addTask(task: Task): Task {
    this.loadFromDisk();
    this.tasks.unshift(task);
    this.saveToDisk();
    return task;
  }

  updateTask(id: string, updatedFields: Partial<Task>): Task | undefined {
    this.loadFromDisk();
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.tasks[index] = {
        ...this.tasks[index],
        ...updatedFields,
        updatedAt: new Date().toISOString(),
      };
      this.saveToDisk();
      return this.tasks[index];
    }
    return undefined;
  }

  deleteTask(id: string): boolean {
    this.loadFromDisk();
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Activity Operations
  getActivity(): ActivityItem[] {
    this.loadFromDisk();
    return this.activity;
  }

  addActivity(item: ActivityItem): void {
    this.loadFromDisk();
    this.activity.unshift(item);
    this.saveToDisk();
  }
}

// Global singleton instance so state persists across hot-reloads and warm lambdas
const globalForDb = globalThis as unknown as {
  persistentDb: PersistentDatabase | undefined;
};

export const db = globalForDb.persistentDb ?? new PersistentDatabase();

globalForDb.persistentDb = db;

export default db;

