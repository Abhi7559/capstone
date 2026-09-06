import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { type AuthSlice, createAuthSlice } from "./authSlice";
import { createFilterSlice, type FilterSlice } from "./filterSlice";
import { createUISlice, type UISlice } from "./uiSlice";

export type BoundState = AuthSlice & UISlice & FilterSlice;

export const useAppStore = create<BoundState>()(
  devtools(
    persist(
      (...a) => ({
        ...createAuthSlice(...a),
        ...createUISlice(...a),
        ...createFilterSlice(...a),
      }),
      {
        name: "task-board-store",
        // Selective persistence: Persist auth & UI preferences only
        partialize: (state) => ({
          currentUser: state.currentUser,
          isAuthenticated: state.isAuthenticated,
          isSidebarCollapsed: state.isSidebarCollapsed,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHydrated(true);
        },
      },
    ),
    { name: "AppStore" },
  ),
);

// Custom Selectors for optimized re-renders
export const useAuth = () =>
  useAppStore((state) => ({
    currentUser: state.currentUser,
    isAuthenticated: state.isAuthenticated,
    isHydrated: state.isHydrated,
    login: state.login,
    logout: state.logout,
  }));

export const useUI = () =>
  useAppStore((state) => ({
    isSidebarCollapsed: state.isSidebarCollapsed,
    isMobileSidebarOpen: state.isMobileSidebarOpen,
    activeModal: state.activeModal,
    toggleSidebar: state.toggleSidebar,
    setMobileSidebarOpen: state.setMobileSidebarOpen,
    openModal: state.openModal,
    closeModal: state.closeModal,
  }));

export const useFilters = () =>
  useAppStore((state) => ({
    projectSearch: state.projectSearch,
    projectStatusFilter: state.projectStatusFilter,
    taskSearch: state.taskSearch,
    taskPriorityFilter: state.taskPriorityFilter,
    taskStatusFilter: state.taskStatusFilter,
    setProjectSearch: state.setProjectSearch,
    setProjectStatusFilter: state.setProjectStatusFilter,
    setTaskSearch: state.setTaskSearch,
    setTaskPriorityFilter: state.setTaskPriorityFilter,
    setTaskStatusFilter: state.setTaskStatusFilter,
    resetFilters: state.resetFilters,
  }));
