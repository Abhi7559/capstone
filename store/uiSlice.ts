import type { StateCreator } from "zustand";

export interface UISlice {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  activeModal: string | null;
  toggleSidebar: () => void;
  setMobileSidebarOpen: (open: boolean) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  activeModal: null,
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setMobileSidebarOpen: (open: boolean) => set({ isMobileSidebarOpen: open }),
  openModal: (modalId: string) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
});
