import { useEffect, useRef, useState } from "react";
import { MultiStepProjectModal } from "@/components/MultiStepProjectModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useMembers } from "@/hooks/useMembers";
import {
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useProjectTasks";
import { useAuthStore } from "@/store/useAuthStore";
import type { Project } from "@/types/project";

export default function ProjectsPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === "admin";

  const { data: projects, isLoading, isError, error } = useProjects();
  const { data: allTasks } = useTasks();
  const { data: members } = useMembers();
  const { deleteProject, isLoading: isDeleting } = useDeleteProject();
  const { updateProject } = useUpdateProject();

  const handleArchiveToggle = async (project: Project) => {
    setActiveDropdownId(null);
    const newStatus = project.status === "active" ? "archived" : "active";
    try {
      await updateProject({
        id: project.id,
        input: { status: newStatus },
      });
      showToast(
        newStatus === "archived"
          ? "Project archived successfully!"
          : "Project restored to active status!",
      );
    } catch {
      showToast("Failed to update project status.");
    }
  };

  const calculateProjectProgress = (projectId: string) => {
    if (!allTasks || allTasks.length === 0) return 0;
    const pTasks = allTasks.filter((t) => t.projectId === projectId);
    if (pTasks.length === 0) return 0;
    const completed = pTasks.filter((t) => t.status === "done").length;
    return Math.round((completed / pTasks.length) * 100);
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdownId(null);
      }
    }

    if (activeDropdownId !== null) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdownId]);

  const handleOpenCreateModal = () => {
    setEditingProject(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (project: Project) => {
    setEditingProject(project);
    setIsModalOpen(true);
    setActiveDropdownId(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProject(null);
  };

  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(
    null,
  );

  const handleConfirmDelete = async () => {
    if (deletingProjectId) {
      try {
        await deleteProject(deletingProjectId);
        showToast("Project deleted successfully!");
      } catch {
        showToast("Failed to delete project.");
      } finally {
        setDeletingProjectId(null);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCopyLink = (projectId: string) => {
    const link = `${window.location.origin}/projects/${projectId}`;
    navigator.clipboard.writeText(link);
    showToast("Project link copied to clipboard!");
    setActiveDropdownId(null);
  };

  // Local state for Search, Filter, Sort, and View mode
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "planning" | "on_hold" | "archived"
  >("all");
  const [sortBy, setSortBy] = useState<"newest" | "name" | "status">("newest");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Metrics calculations
  const allProjectsList = projects || [];
  const totalCount = allProjectsList.length;
  const activeCount = allProjectsList.filter(
    (p) => p.status === "active",
  ).length;
  const planningCount = allProjectsList.filter(
    (p) => p.status === "planning",
  ).length;
  const onHoldCount = allProjectsList.filter(
    (p) => p.status === "on_hold",
  ).length;
  const archivedCount = allProjectsList.filter(
    (p) => p.status === "archived" || p.status === "completed",
  ).length;
  const avgProgress =
    totalCount > 0
      ? Math.round(
          allProjectsList.reduce(
            (acc, p) => acc + calculateProjectProgress(p.id),
            0,
          ) / totalCount,
        )
      : 0;

  // Local filtering & sorting logic
  const filteredProjects = allProjectsList
    .filter((project) => {
      const matchesSearch =
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "archived"
            ? project.status === "archived" || project.status === "completed"
            : project.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return a.status.localeCompare(b.status);
    });

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Helper function to render avatar stacks for member IDs
  const renderAvatarStack = (memberIds?: string[]) => {
    if (!memberIds || memberIds.length === 0) {
      return (
        <span className="text-xs italic text-gray-400">
          No members assigned
        </span>
      );
    }

    const assignedMembers = memberIds
      .map((id) => (members || []).find((m) => m.id === id))
      .filter(Boolean);

    const displayMembers = assignedMembers.slice(0, 3);
    const overflowCount = memberIds.length - displayMembers.length;

    const bgColors = [
      "bg-blue-600",
      "bg-purple-600",
      "bg-emerald-600",
      "bg-amber-600",
      "bg-rose-600",
    ];

    return (
      <div className="flex items-center space-x-1">
        <div className="flex -space-x-2 overflow-hidden">
          {displayMembers.map((m, idx) => {
            const initials = m?.name
              ? m.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)
              : "U";
            const colorClass = bgColors[idx % bgColors.length];
            return (
              <div
                key={m?.id || idx}
                title={m?.name || "Member"}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${colorClass} text-[10px] font-bold text-white ring-2 ring-white shadow-xs`}
              >
                {initials}
              </div>
            );
          })}
        </div>
        {overflowCount > 0 && (
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 border border-gray-200">
            +{overflowCount}
          </span>
        )}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-slate-50/50 font-sans">
        <Sidebar
          activeTab="projects"
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            title="Projects"
            onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-6 md:p-8 overflow-y-auto">
            {/* Page Header */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                  Projects Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  {isAdmin
                    ? "Manage active projects, assign team members, and track project lifecycle."
                    : "View active workspace projects you are assigned to."}
                </p>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-blue-700 active:scale-95 focus:outline-none"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <title>Plus Icon</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Project
                </button>
              )}
            </div>

            {/* Top Summary Metrics Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {/* Card 1: Total */}
              <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Total Projects
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    📂
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900">
                    {totalCount}
                  </span>
                  <span className="text-[11px] font-medium text-gray-500">
                    workspaces
                  </span>
                </div>
              </div>

              {/* Card 2: Active */}
              <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                    Active
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
                    🟢
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-700">
                    {activeCount}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600/80">
                    in progress
                  </span>
                </div>
              </div>

              {/* Card 3: Archived */}
              <div className="rounded-2xl border border-purple-100 bg-white p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                    Archived
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold">
                    📁
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-purple-700">
                    {archivedCount}
                  </span>
                  <span className="text-[11px] font-medium text-purple-600/80">
                    completed
                  </span>
                </div>
              </div>

              {/* Card 4: Avg Progress */}
              <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Avg Progress
                  </span>
                  <span className="text-xs font-bold text-blue-600">
                    {avgProgress}%
                  </span>
                </div>
                <div className="mt-3">
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                      style={{ width: `${avgProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Status Filter Tabs & Search Bar */}
            <div className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Quick Filter Pill Tabs */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    statusFilter === "all"
                      ? "bg-gray-900 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All Projects
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      statusFilter === "all"
                        ? "bg-gray-800 text-gray-200"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {totalCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("active")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    statusFilter === "active"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  Active
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      statusFilter === "active"
                        ? "bg-emerald-700 text-emerald-100"
                        : "bg-emerald-200/60 text-emerald-800"
                    }`}
                  >
                    {activeCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("planning")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    statusFilter === "planning"
                      ? "bg-sky-600 text-white shadow-sm"
                      : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                  }`}
                >
                  Planning
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      statusFilter === "planning"
                        ? "bg-sky-700 text-sky-100"
                        : "bg-sky-200/60 text-sky-800"
                    }`}
                  >
                    {planningCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("on_hold")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    statusFilter === "on_hold"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                  }`}
                >
                  On Hold
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      statusFilter === "on_hold"
                        ? "bg-amber-700 text-amber-100"
                        : "bg-amber-200/60 text-amber-800"
                    }`}
                  >
                    {onHoldCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusFilter("archived")}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                    statusFilter === "archived"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                  }`}
                >
                  Archived
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      statusFilter === "archived"
                        ? "bg-purple-700 text-purple-100"
                        : "bg-purple-200/60 text-purple-800"
                    }`}
                  >
                    {archivedCount}
                  </span>
                </button>
              </div>

              {/* Search & View Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px] max-w-xs">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3.5 py-2 pl-9 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <svg
                    className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <title>Search Icon</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>

                {/* Sort Control */}
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(e.target.value as "newest" | "name" | "status")
                  }
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="newest">Sort by Newest Created</option>
                  <option value="name">Sort by Name</option>
                  <option value="status">Sort by Status</option>
                </select>

                {/* View Switcher: Cards vs Table */}
                <div className="flex items-center space-x-1 rounded-xl border border-gray-200 bg-gray-100/80 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("cards")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      viewMode === "cards"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      viewMode === "table"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Table
                  </button>
                </div>
              </div>
            </div>

            {/* Projects View */}
            {isLoading ? (
              <div className="p-12 text-center text-gray-500 font-medium">
                Loading projects...
              </div>
            ) : isError ? (
              <div className="rounded-2xl bg-red-50 p-6 text-center border border-red-200 text-red-700">
                {error ? (error as Error).message : "Failed to load projects."}
              </div>
            ) : filteredProjects.length === 0 ? (
              /* Empty State */
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500 space-y-3">
                <div className="text-3xl">📁</div>
                <h3 className="text-base font-bold text-gray-900">
                  No projects found
                </h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  No matching projects correspond to your search query or status
                  filter. Try clearing filters or creating a new project.
                </p>
                {(searchQuery || statusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                    className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
                  >
                    Clear Search & Filters
                  </button>
                )}
              </div>
            ) : viewMode === "cards" ? (
              /* CARDS VIEW */
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => {
                  const isDropdownOpen = activeDropdownId === project.id;
                  const isProjectActive = project.status === "active";
                  const progressPct = calculateProjectProgress(project.id);

                  return (
                    <div
                      key={project.id}
                      className="group relative flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div>
                        {/* Header: Title, Status Badge, & Kebab Actions Menu */}
                        <div className="flex justify-between items-start mb-3 gap-2 min-w-0">
                          <a
                            href={`/projects/${project.id}?tab=kanban`}
                            className="text-base font-bold text-gray-900 leading-snug hover:text-blue-600 transition break-all break-words min-w-0"
                          >
                            {project.name}
                          </a>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                                project.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                  : project.status === "planning"
                                    ? "bg-sky-50 text-sky-700 border border-sky-200/60"
                                    : project.status === "on_hold"
                                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                      : "bg-purple-50 text-purple-700 border border-purple-200/60"
                              }`}
                            >
                              {project.status.replace("_", " ")}
                            </span>

                            {/* Kebab Action Dropdown Toggle */}
                            <div
                              className="relative"
                              ref={isDropdownOpen ? dropdownRef : null}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveDropdownId(
                                    isDropdownOpen ? null : project.id,
                                  )
                                }
                                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition focus:outline-none"
                                aria-label="Project actions menu"
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                  aria-hidden="true"
                                >
                                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                </svg>
                              </button>

                              {/* Dropdown Menu */}
                              {isDropdownOpen && (
                                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-white p-1.5 shadow-xl border border-gray-100 z-20 text-xs space-y-0.5">
                                  <a
                                    href={`/projects/${project.id}?tab=kanban`}
                                    className="flex items-center px-3 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition"
                                  >
                                    🚀 Open Kanban
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyLink(project.id)}
                                    className="w-full flex items-center px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition text-left"
                                  >
                                    📋 Copy Link
                                  </button>
                                  {isAdmin && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleOpenEditModal(project)
                                        }
                                        className="w-full flex items-center px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-50 transition text-left"
                                      >
                                        ✏️ Edit Details
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleArchiveToggle(project)
                                        }
                                        className="w-full flex items-center px-3 py-2 rounded-lg text-amber-700 hover:bg-amber-50 transition text-left font-medium"
                                      >
                                        {project.status === "active"
                                          ? "📦 Archive Project"
                                          : "🔄 Restore Project"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveDropdownId(null);
                                          setDeletingProjectId(project.id);
                                        }}
                                        className="w-full flex items-center px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition text-left font-medium"
                                      >
                                        🗑️ Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 mb-4 line-clamp-2 leading-relaxed break-all break-words">
                          {project.description}
                        </p>

                        {/* Progress Bar */}
                        <div className="mb-5 space-y-1.5">
                          <div className="flex justify-between text-[11px] text-gray-500 font-medium">
                            <span>Completion Progress</span>
                            <span className="font-bold text-gray-800">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isProjectActive
                                  ? "bg-blue-600"
                                  : "bg-emerald-600"
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer: Member Avatars & Primary Button */}
                      <div className="border-t border-gray-100 pt-4 mt-auto">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                            Team
                          </span>
                          {renderAvatarStack(project.memberIds)}
                        </div>

                        <div className="flex items-center space-x-2">
                          <a
                            href={`/projects/${project.id}`}
                            className="flex-1 text-center rounded-xl bg-blue-50 border border-blue-200/80 py-2 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition shadow-2xs"
                          >
                            View Details →
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-visible">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50/80 text-[11px] uppercase text-gray-400 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3.5">Project Name</th>
                      <th className="px-6 py-3.5">Description</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Team</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 overflow-visible">
                    {filteredProjects.map((project) => (
                      <tr
                        key={project.id}
                        className="hover:bg-gray-50/60 transition"
                      >
                        <td className="px-6 py-4 font-bold text-gray-900">
                          <a
                            href={`/projects/${project.id}?tab=kanban`}
                            className="hover:text-blue-600 transition"
                          >
                            {project.name}
                          </a>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">
                          {project.description}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                              project.status === "active"
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-purple-50 text-purple-800"
                            }`}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {renderAvatarStack(project.memberIds)}
                        </td>
                        <td className="px-6 py-4 text-right relative">
                          {(() => {
                            const isDropdownOpen =
                              activeDropdownId === project.id;
                            return (
                              <div
                                className="relative inline-block text-left"
                                ref={isDropdownOpen ? dropdownRef : null}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveDropdownId(
                                      isDropdownOpen ? null : project.id,
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition focus:outline-none"
                                  aria-label="Project actions menu"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                                  </svg>
                                </button>

                                {/* Table Dropdown Menu Matching Image 2 */}
                                {isDropdownOpen && (
                                  <div className="absolute right-0 top-full mt-1 w-48 rounded-2xl bg-white p-2.5 shadow-2xl border border-gray-100 z-50 text-xs space-y-1 text-left animate-in fade-in zoom-in-95 duration-100">
                                    <a
                                      href={`/projects/${project.id}?tab=kanban`}
                                      className="flex items-center px-3 py-2 rounded-xl text-gray-700 hover:bg-blue-50 hover:text-blue-600 font-medium transition"
                                    >
                                      🚀 Open Kanban
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(project.id)}
                                      className="w-full flex items-center px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition text-left"
                                    >
                                      📋 Copy Link
                                    </button>
                                    {isAdmin && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOpenEditModal(project)
                                          }
                                          className="w-full flex items-center px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-50 font-medium transition text-left"
                                        >
                                          ✏️ Edit Details
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleArchiveToggle(project)
                                          }
                                          className="w-full flex items-center px-3 py-2 rounded-xl text-amber-700 hover:bg-amber-50 font-medium transition text-left"
                                        >
                                          {project.status === "active"
                                            ? "📦 Archive Project"
                                            : "🔄 Restore Project"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveDropdownId(null);
                                            setDeletingProjectId(project.id);
                                          }}
                                          className="w-full flex items-center px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 font-medium transition text-left"
                                        >
                                          🗑️ Delete
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Top-Center Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center space-x-3 rounded-full bg-slate-900/90 backdrop-blur-md text-white px-5 py-2.5 text-xs font-semibold shadow-2xl border border-slate-700/50 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white transition"
          >
            ✕
          </button>
        </div>
      )}

      {/* Multi-Step 4-Step Project Wizard Modal Component */}
      <MultiStepProjectModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingProject={editingProject}
        onSuccess={showToast}
      />
      {/* Delete Confirmation Modal */}
      {Boolean(deletingProjectId) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-gray-100 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Delete Project</h3>
            <p className="text-xs text-gray-600">
              Are you sure you want to delete this project? This action cannot
              be undone.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingProjectId(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
              >
                {isDeleting ? "Deleting..." : "Delete Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
