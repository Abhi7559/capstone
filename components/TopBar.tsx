import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { MultiStepCreateTaskModal } from "@/components/MultiStepCreateTaskModal";
import { MultiStepProjectModal } from "@/components/MultiStepProjectModal";
import { useAuthStore } from "@/store/useAuthStore";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onMobileMenuToggle?: () => void;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export function TopBar({
  title,
  subtitle,
  onMobileMenuToggle,
  actionButton,
}: TopBarProps) {
  const { currentUser, logout } = useAuthStore();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }

    if (showProfileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showProfileMenu]);

  // Global Create Selector Modal State
  const [isCreateSelectorOpen, setIsCreateSelectorOpen] = useState(false);
  const [selectedCreateType, setSelectedCreateType] = useState<
    "project" | "task"
  >("project");

  // Specific Form Modal States
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isAdmin = currentUser?.role === "admin";

  const handleProceedCreate = () => {
    setIsCreateSelectorOpen(false);
    if (selectedCreateType === "project") {
      setIsProjectModalOpen(true);
    } else if (selectedCreateType === "task") {
      setIsTaskModalOpen(true);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-gray-200 bg-white/95 px-4 md:px-8 backdrop-blur transition-all">
        {/* Left side: Mobile Menu Toggle & Page Title */}
        <div className="flex items-center space-x-3 md:space-x-4">
          {onMobileMenuToggle && (
            <button
              type="button"
              onClick={onMobileMenuToggle}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none"
              aria-label="Open Mobile Menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          )}

          {title ? (
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-900 leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-xs text-gray-500 hidden md:block mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <span className="font-bold text-base tracking-wide text-gray-900">
                Overview
              </span>
            </div>
          )}
        </div>

        {/* Right side: Global Create Button, User Avatar & Profile Dropdown */}
        <div className="flex items-center space-x-4">
          {actionButton ? (
            <button
              type="button"
              onClick={actionButton.onClick}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none"
            >
              {actionButton.label}
            </button>
          ) : isAdmin ? (
            /* Pill-shaped Create Button matching wireframe image - Admin Only */
            <button
              type="button"
              onClick={() => setIsCreateSelectorOpen(true)}
              className="rounded-full bg-gray-200 text-gray-900 hover:bg-gray-300 px-6 py-2 text-xs font-bold transition shadow-sm focus:outline-none"
            >
              Create
            </button>
          ) : null}

          {/* User Profile Avatar & Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setShowProfileMenu((prev) => !prev)}
              className="flex items-center space-x-3 border-l pl-4 border-gray-200 focus:outline-none group text-left"
            >
              {/* User Avatar */}
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm ring-2 ring-blue-500/20">
                {getInitials(currentUser?.name)}
              </div>

              <div className="hidden sm:block">
                <p className="text-xs font-bold text-gray-900 leading-tight group-hover:text-blue-600 transition">
                  {currentUser?.name || "User"}
                </p>
                <span
                  className={`inline-block px-1.5 py-0.5 text-[10px] font-extrabold uppercase rounded mt-0.5 ${
                    isAdmin
                      ? "bg-purple-100 text-purple-800 border border-purple-200"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                  }`}
                >
                  {currentUser?.role || "MEMBER"}
                </span>
              </div>
            </button>

            {/* Profile Dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white p-2 shadow-lg border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-gray-100 mb-1">
                  <p className="text-xs font-bold text-gray-900">
                    {currentUser?.name}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {currentUser?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <svg
                    className="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <title>Logout Icon</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* "Create New" Selector Modal (Matching Wireframe Images MacBook Air 11 & 12) */}
      {isCreateSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-6">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900 w-full text-center pl-6">
                Create New
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateSelectorOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {/* Selection Options List matching Wireframe */}
            <div className="space-y-3">
              {/* Option 1: Project */}
              <button
                type="button"
                onClick={() => setSelectedCreateType("project")}
                className={`w-full flex items-center space-x-4 p-4 rounded-xl border transition-all text-left ${
                  selectedCreateType === "project"
                    ? "border-gray-900 bg-gray-50 ring-2 ring-gray-900/10"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center border transition-all ${
                    selectedCreateType === "project"
                      ? "bg-gray-900 border-gray-900 text-white"
                      : "border-gray-300 text-transparent"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <title>Selected</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <span className="block text-sm font-bold text-gray-900">
                    Project
                  </span>
                  <span className="block text-xs text-gray-500">
                    Create a new project workspace
                  </span>
                </div>
              </button>

              {/* Option 2: Task */}
              <button
                type="button"
                onClick={() => setSelectedCreateType("task")}
                className={`w-full flex items-center space-x-4 p-4 rounded-xl border transition-all text-left ${
                  selectedCreateType === "task"
                    ? "border-gray-900 bg-gray-50 ring-2 ring-gray-900/10"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center border transition-all ${
                    selectedCreateType === "task"
                      ? "bg-gray-900 border-gray-900 text-white"
                      : "border-gray-300 text-transparent"
                  }`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <title>Selected</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <span className="block text-sm font-bold text-gray-900">
                    Task
                  </span>
                  <span className="block text-xs text-gray-500">
                    Create & assign a new task
                  </span>
                </div>
              </button>
            </div>

            {/* Submit Action Button matching Wireframe */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleProceedCreate}
                className="w-full rounded-full bg-gray-200 hover:bg-gray-300 text-gray-900 py-3 text-xs font-bold transition focus:outline-none"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Form Modals */}
      <MultiStepProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
      />

      <MultiStepCreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
      />
    </>
  );
}
