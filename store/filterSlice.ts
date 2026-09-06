import type { StateCreator } from "zustand";

export interface FilterSlice {
  projectSearch: string;
  projectStatusFilter: string;
  taskSearch: string;
  taskPriorityFilter: string;
  taskStatusFilter: string;
  setProjectSearch: (search: string) => void;
  setProjectStatusFilter: (status: string) => void;
  setTaskSearch: (search: string) => void;
  setTaskPriorityFilter: (priority: string) => void;
  setTaskStatusFilter: (status: string) => void;
  resetFilters: () => void;
}

export const createFilterSlice: StateCreator<FilterSlice> = (set) => ({
  projectSearch: "",
  projectStatusFilter: "all",
  taskSearch: "",
  taskPriorityFilter: "all",
  taskStatusFilter: "all",
  setProjectSearch: (search: string) => set({ projectSearch: search }),
  setProjectStatusFilter: (status: string) =>
    set({ projectStatusFilter: status }),
  setTaskSearch: (search: string) => set({ taskSearch: search }),
  setTaskPriorityFilter: (priority: string) =>
    set({ taskPriorityFilter: priority }),
  setTaskStatusFilter: (status: string) => set({ taskStatusFilter: status }),
  resetFilters: () =>
    set({
      projectSearch: "",
      projectStatusFilter: "all",
      taskSearch: "",
      taskPriorityFilter: "all",
      taskStatusFilter: "all",
    }),
});
