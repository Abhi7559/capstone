import type { User } from "@/types/auth";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";

const MEMBERS_KEY = "capstone_local_members";
const PROJECTS_KEY = "capstone_local_projects";
const TASKS_KEY = "capstone_local_tasks";

const isClient = typeof window !== "undefined";

// --- MEMBERS ---
export function getLocalMembers(): User[] {
  if (!isClient) return [];
  try {
    const data = localStorage.getItem(MEMBERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalMembers(members: User[]): void {
  if (!isClient) return;
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  } catch (err) {
    console.error("Failed to save members to localStorage", err);
  }
}

export function addOrUpdateLocalMember(member: User): void {
  const current = getLocalMembers();
  const index = current.findIndex(
    (m) =>
      m.id === member.id ||
      m.email.toLowerCase() === member.email.toLowerCase(),
  );
  if (index !== -1) {
    current[index] = { ...current[index], ...member };
  } else {
    current.unshift(member);
  }
  saveLocalMembers(current);
}

export function removeLocalMember(id: string): void {
  const current = getLocalMembers();
  const updated = current.filter((m) => m.id !== id);
  saveLocalMembers(updated);
}

export function mergeMembersWithLocal(apiMembers: User[]): User[] {
  const localMembers = getLocalMembers();
  if (localMembers.length === 0) {
    saveLocalMembers(apiMembers);
    return apiMembers;
  }

  const map = new Map<string, User>();
  for (const m of apiMembers) {
    map.set(m.id, m);
  }
  for (const m of localMembers) {
    if (!map.has(m.id)) {
      map.set(m.id, m);
    }
  }
  const merged = Array.from(map.values());
  saveLocalMembers(merged);
  return merged;
}

// --- PROJECTS ---
export function getLocalProjects(): Project[] {
  if (!isClient) return [];
  try {
    const data = localStorage.getItem(PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects: Project[]): void {
  if (!isClient) return;
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch (err) {
    console.error("Failed to save projects to localStorage", err);
  }
}

export function addOrUpdateLocalProject(project: Project): void {
  const current = getLocalProjects();
  const index = current.findIndex((p) => p.id === project.id);
  if (index !== -1) {
    current[index] = { ...current[index], ...project };
  } else {
    current.unshift(project);
  }
  saveLocalProjects(current);
}

export function removeLocalProject(id: string): void {
  const current = getLocalProjects();
  const updated = current.filter((p) => p.id !== id);
  saveLocalProjects(updated);
}

export function mergeProjectsWithLocal(apiProjects: Project[]): Project[] {
  const localProjects = getLocalProjects();
  if (localProjects.length === 0) {
    saveLocalProjects(apiProjects);
    return apiProjects;
  }

  const map = new Map<string, Project>();
  for (const p of apiProjects) {
    map.set(p.id, p);
  }
  for (const p of localProjects) {
    if (!map.has(p.id)) {
      map.set(p.id, p);
    }
  }
  const merged = Array.from(map.values());
  saveLocalProjects(merged);
  return merged;
}

// --- TASKS ---
export function getLocalTasks(): Task[] {
  if (!isClient) return [];
  try {
    const data = localStorage.getItem(TASKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveLocalTasks(tasks: Task[]): void {
  if (!isClient) return;
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error("Failed to save tasks to localStorage", err);
  }
}

export function addOrUpdateLocalTask(task: Task): void {
  const current = getLocalTasks();
  const index = current.findIndex((t) => t.id === task.id);
  if (index !== -1) {
    current[index] = { ...current[index], ...task };
  } else {
    current.unshift(task);
  }
  saveLocalTasks(current);
}

export function removeLocalTask(id: string): void {
  const current = getLocalTasks();
  const updated = current.filter((t) => t.id !== id);
  saveLocalTasks(updated);
}

export function mergeTasksWithLocal(apiTasks: Task[]): Task[] {
  const localTasks = getLocalTasks();
  if (localTasks.length === 0) {
    saveLocalTasks(apiTasks);
    return apiTasks;
  }

  const map = new Map<string, Task>();
  for (const t of apiTasks) {
    map.set(t.id, t);
  }
  for (const t of localTasks) {
    if (!map.has(t.id)) {
      map.set(t.id, t);
    }
  }
  const merged = Array.from(map.values());
  saveLocalTasks(merged);
  return merged;
}
