import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { MultiStepCreateTaskModal } from "@/components/MultiStepCreateTaskModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { TopBar } from "@/components/TopBar";
import { useMembers } from "@/hooks/useMembers";
import { useProjects } from "@/hooks/useProjects";
import { useDeleteTask, useTasks, useUpdateTask } from "@/hooks/useProjectTasks";
import { useAuthStore } from "@/store/useAuthStore";
import type { Task, TaskFilters, TaskPriority, TaskStatus } from "@/types/task";

interface KanbanColumn {
  id: string;
  label: string;
  status: string;
  color: string;
  isCustom?: boolean;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  {
    id: "col_backlog",
    label: "BACKLOG",
    status: "backlog",
    color: "bg-gray-100 border-gray-300 text-gray-700",
  },
  {
    id: "col_todo",
    label: "TO DO",
    status: "todo",
    color: "bg-slate-100 border-slate-300 text-slate-700",
  },
  {
    id: "col_in_progress",
    label: "IN PROGRESS",
    status: "in_progress",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  {
    id: "col_done",
    label: "COMPLETED",
    status: "done",
    color: "bg-green-50 border-green-200 text-green-800",
  },
];

export default function ProjectTaskBoardPage() {
  const router = useRouter();
  const { id } = router.query;
  const projectId = typeof id === "string" ? id : "";

  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === "admin";

  const { data: projects } = useProjects();
  const currentProject = projects?.find((p) => p.id === projectId);

  const { data: members } = useMembers();

  const { updateTask } = useUpdateTask();
  const { deleteTask, isLoading: isDeletingTask } = useDeleteTask();

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Dynamic Custom Columns State
  const [columns, setColumns] = useState<KanbanColumn[]>(DEFAULT_COLUMNS);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    const colStatus = newColumnName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_");
    const newCol: KanbanColumn = {
      id: `col_${Date.now()}`,
      label: newColumnName.trim().toUpperCase(),
      status: colStatus,
      color: "bg-purple-50 border-purple-200 text-purple-800",
      isCustom: true,
    };
    setColumns((prev) => [...prev, newCol]);
    setNewColumnName("");
    setIsAddColumnModalOpen(false);
    showToast("Column added successfully!");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleConfirmDeleteTask = async () => {
    if (deletingTask) {
      try {
        await deleteTask(deletingTask.id);
        showToast("Task deleted successfully!");
      } catch {
        showToast("Failed to delete task.");
      } finally {
        setDeletingTask(null);
      }
    }
  };

  const handleDeleteColumn = async (colToDelete: KanbanColumn) => {
    // Reassign all tasks in deleted column back to 'backlog'
    const tasksInColumn = (tasks || []).filter(
      (t) => t.status === colToDelete.status,
    );
    for (const t of tasksInColumn) {
      try {
        await updateTask({
          taskId: t.id,
          input: { status: "backlog", projectId: t.projectId },
        });
      } catch {
        // Ignored
      }
    }
    setColumns((prev) => prev.filter((c) => c.id !== colToDelete.id));
    showToast(`Column ${colToDelete.label} deleted!`);
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<TaskFilters>({
    status: "all",
    priority: "all",
    assigneeId: "all",
    dueDate: "",
  });

  const handleClearFilters = () => {
    setFilters({
      status: "all",
      priority: "all",
      assigneeId: "all",
      dueDate: "",
    });
    setSearchQuery("");
  };

  const {
    data: rawTasks,
    isLoading,
    isError,
    error,
  } = useTasks(projectId, filters);

  const tasks = (rawTasks || []).filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = t.title.toLowerCase().includes(query);
    const descMatch = t.description.toLowerCase().includes(query);
    const tagMatch = t.tags?.some((tag) => tag.toLowerCase().includes(query));
    return titleMatch || descMatch || tagMatch;
  });

  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const getAssigneeName = (assigneeId: string) => {
    if (assigneeId === currentUser?.id) return `${currentUser.name} (You)`;
    const memberMatch = members?.find((m) => m.id === assigneeId);
    return memberMatch ? memberMatch.name : "System User";
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTaskId(task.id);
    e.dataTransfer.setData("text/plain", task.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = draggedTaskId || e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const targetTask = tasks?.find((t) => t.id === taskId);
    if (targetTask && targetTask.status !== targetStatus) {
      try {
        await updateTask({
          taskId: targetTask.id,
          input: { status: targetStatus, projectId: targetTask.projectId },
        });
        const colLabel =
          columns.find((c) => c.status === targetStatus)?.label || targetStatus;
        showToast(`Task moved to ${colLabel}!`);
      } catch {
        showToast("Failed to move task.");
      }
    }
    setDraggedTaskId(null);
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "kanban" | "members" | "activity"
  >("overview");

  useEffect(() => {
    if (router.query.tab === "kanban") {
      setActiveTab("kanban");
    } else if (router.query.tab === "members") {
      setActiveTab("members");
    } else if (router.query.tab === "activity") {
      setActiveTab("activity");
    }
  }, [router.query.tab]);

  const projectTasks = tasks || [];

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-100 font-sans">
        <Sidebar
          activeTab="projects"
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            title={
              activeTab === "overview"
                ? "Project Details"
                : activeTab === "kanban"
                  ? "Kanban Board"
                  : activeTab === "members"
                    ? "Team Members"
                    : "Activity Log"
            }
            onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-8 overflow-y-auto">
            {/* Header */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 mb-2 inline-flex items-center space-x-1"
              >
                <span>← Back to Projects</span>
              </button>
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {currentProject?.name || "Project Details"}
                  </h1>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Tab Switcher per Specification 4.6 */}
                  <div className="flex items-center rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setActiveTab("overview")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        activeTab === "overview"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("kanban")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        activeTab === "kanban"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Kanban Board
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("members")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        activeTab === "members"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Members
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("activity")}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        activeTab === "activity"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Activity
                    </button>
                  </div>

                  {isAdmin && activeTab === "kanban" && (
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setIsAddColumnModalOpen(true)}
                        className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none"
                      >
                        + Add Column
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsTaskModalOpen(true)}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none"
                      >
                        + Create Task
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {activeTab === "overview" ? (
              /* PROJECT OVERVIEW INFORMATION VIEW */
              <div className="space-y-6">
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">
                        Project Information
                      </h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Overview of key milestones, progress metrics, and team
                        members.
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                        currentProject?.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {currentProject?.status || "Active"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {currentProject?.description ||
                      "No project description provided."}
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  {/* Key Details & Progress Metrics Card */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Key Metrics & Progress
                    </h3>

                    {/* Progress Bar */}
                    {(() => {
                      const total = projectTasks.length;
                      const completed = projectTasks.filter(
                        (t) => t.status === "done",
                      ).length;
                      const inProgress = projectTasks.filter(
                        (t) => t.status === "in_progress",
                      ).length;
                      const pct =
                        total > 0 ? Math.round((completed / total) * 100) : 0;
                      const formattedCreatedDate = currentProject?.createdAt
                        ? new Date(currentProject.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )
                        : "N/A";

                      return (
                        <>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold text-gray-700">
                              <span>Project Completion</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="divide-y divide-gray-100 text-xs text-gray-600 pt-2">
                            <div className="flex justify-between py-2">
                              <span className="font-medium text-gray-500">
                                Created Date:
                              </span>
                              <span className="font-semibold text-gray-900">
                                {formattedCreatedDate}
                              </span>
                            </div>
                            <div className="flex justify-between py-2">
                              <span className="font-medium text-gray-500">
                                Total Tasks:
                              </span>
                              <span className="font-semibold text-gray-900">
                                {total} {total === 1 ? "task" : "tasks"}
                              </span>
                            </div>
                            <div className="flex justify-between py-2">
                              <span className="font-medium text-gray-500">
                                Completed Tasks:
                              </span>
                              <span className="font-semibold text-green-600">
                                {completed} tasks
                              </span>
                            </div>
                            <div className="flex justify-between py-2">
                              <span className="font-medium text-gray-500">
                                In Progress:
                              </span>
                              <span className="font-semibold text-blue-600">
                                {inProgress} tasks
                              </span>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Assigned Team Members Card */}
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Assigned Team Members
                    </h3>
                    <div className="space-y-2">
                      {(() => {
                        const assigned = (members || []).filter((m) =>
                          currentProject?.memberIds &&
                          currentProject.memberIds.length > 0
                            ? currentProject.memberIds.includes(m.id)
                            : true,
                        );

                        if (assigned.length === 0) {
                          return (
                            <p className="text-xs text-gray-500 py-4 text-center">
                              No members assigned yet.
                            </p>
                          );
                        }

                        return assigned.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between rounded-lg bg-gray-50 p-2.5"
                          >
                            <div className="flex items-center space-x-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-xs font-bold text-white uppercase shadow-sm">
                                {member.name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-900">
                                  {member.name}
                                </p>
                                <p className="text-[10px] text-gray-500">
                                  {member.email}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${
                                member.role === "admin"
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : "bg-blue-100 text-blue-800 border border-blue-200"
                              }`}
                            >
                              {member.role}
                            </span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === "members" ? (
              /* MEMBERS TAB VIEW */
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Project Team Members
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {(() => {
                    const assignedMembers = (members || []).filter((m) =>
                      currentProject?.memberIds
                        ? currentProject.memberIds.includes(m.id)
                        : true,
                    );
                    if (assignedMembers.length === 0) {
                      return (
                        <p className="text-xs text-gray-500 col-span-full">
                          No team members assigned to this project yet.
                        </p>
                      );
                    }
                    return assignedMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center space-x-3 rounded-xl border border-gray-200 p-4 bg-gray-50/50"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 font-bold text-white text-sm uppercase">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {member.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {member.email}
                          </p>
                          <span className="inline-block mt-1 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 capitalize">
                            {member.role}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : activeTab === "activity" ? (
              /* ACTIVITY TAB VIEW */
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Project Activity Stream
                </h2>
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 text-xs border-b border-gray-100 pb-3">
                    <span className="text-base">🚀</span>
                    <div>
                      <p className="font-bold text-gray-900">
                        Project initialized
                      </p>
                      <p className="text-gray-500">
                        System Admin created the project workspace.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3 text-xs border-b border-gray-100 pb-3">
                    <span className="text-base">👤</span>
                    <div>
                      <p className="font-bold text-gray-900">
                        Team members assigned
                      </p>
                      <p className="text-gray-500">
                        Project team members attached to project configuration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* KANBAN BOARD VIEW */
              <>
                {/* Task Filter & Search Bar */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm mb-8 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3 text-sm flex-1">
                    {/* Task Search Input */}
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                      <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 pl-8 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                      <svg
                        className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5"
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

                    <span className="font-semibold text-gray-700 text-xs uppercase tracking-wider hidden sm:inline">
                      FILTER BY:
                    </span>

                    {/* Status Filter */}
                    <div>
                      <select
                        value={filters.status || "all"}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            status: e.target.value as TaskStatus | "all",
                          }))
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 capitalize"
                      >
                        <option value="all">All Statuses</option>
                        {columns.map((col) => (
                          <option key={col.status} value={col.status}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Priority Filter */}
                    <div>
                      <select
                        value={filters.priority || "all"}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            priority: e.target.value as TaskPriority | "all",
                          }))
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="all">All Priorities</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>

                    {/* Assignee Filter */}
                    <div>
                      <select
                        value={filters.assigneeId || "all"}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            assigneeId: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="all">All Assignees</option>
                        {currentUser && (
                          <option value={currentUser.id}>
                            {currentUser.name} (You)
                          </option>
                        )}
                        {members?.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Only My Tasks Radio Button Toggle */}
                    <label
                      htmlFor="myTasksRadio"
                      className="inline-flex items-center space-x-2 cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition select-none"
                    >
                      <input
                        id="myTasksRadio"
                        type="radio"
                        checked={filters.assigneeId === currentUser?.id}
                        onClick={() => {
                          if (filters.assigneeId === currentUser?.id) {
                            setFilters((prev) => ({
                              ...prev,
                              assigneeId: "all",
                            }));
                          } else if (currentUser) {
                            setFilters((prev) => ({
                              ...prev,
                              assigneeId: currentUser.id,
                            }));
                          }
                        }}
                        onChange={() => {}}
                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Only My Tasks</span>
                    </label>
                  </div>

                  {/* Clear Filters Button */}
                  {(searchQuery ||
                    filters.status !== "all" ||
                    filters.priority !== "all" ||
                    filters.assigneeId !== "all") && (
                    <button
                      type="button"
                      onClick={handleClearFilters}
                      className="rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
                    >
                      Clear Filters ✕
                    </button>
                  )}
                </div>

                {/* Kanban Board Area */}
                {isLoading ? (
                  <div className="p-12 text-center text-gray-500 font-medium">
                    Loading project tasks...
                  </div>
                ) : isError ? (
                  <div className="rounded-xl bg-red-50 p-6 text-center border border-red-200 text-red-700 font-medium">
                    {error
                      ? (error as Error).message
                      : "Failed to load project tasks."}
                  </div>
                ) : (
                  <div className="flex flex-wrap lg:flex-nowrap gap-6 overflow-x-auto pb-4">
                    {columns.map((col) => {
                      const columnTasks = (tasks || []).filter(
                        (t) => t.status === col.status,
                      );

                      return (
                        <section
                          key={col.status}
                          aria-label={`${col.label} column`}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, col.status)}
                          className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50/70 p-4 min-h-[520px] w-full min-w-[280px] lg:w-1/3 flex-1 transition-colors hover:border-gray-300"
                        >
                          {/* Column Header */}
                          <div className="flex justify-between items-center mb-4 px-1 pb-2 border-b border-gray-200/80">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider ${col.color}`}
                              >
                                {col.label}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-gray-600 shadow-sm border border-gray-200">
                                {columnTasks.length}
                              </span>
                              {isAdmin &&
                                (col.isCustom || col.status !== "backlog") && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteColumn(col)}
                                    title="Delete column (moves tasks back to BACKLOG)"
                                    className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <title>Delete Column Icon</title>
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                )}
                            </div>
                          </div>

                          {/* Column Task Cards Container */}
                          <div className="flex-1 space-y-3 flex flex-col">
                            {columnTasks.length === 0 ? (
                              <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-gray-300 p-8 text-center text-xs text-gray-400 bg-white/50 min-h-[220px]">
                                No tasks in {col.status === "in_progress" ? "progress" : col.label.toLowerCase()}
                              </div>
                            ) : (
                              columnTasks.map((task) => {
                                  const canUserUpdateTaskStatus =
                                    isAdmin ||
                                    (Boolean(currentUser?.id) &&
                                      task.assigneeId === currentUser?.id);

                                return (
                                  <article
                                    key={task.id}
                                    draggable={canUserUpdateTaskStatus}
                                    onDragStart={(e) =>
                                      handleDragStart(e, task)
                                    }
                                    className={`group rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3 transition-all ${
                                      canUserUpdateTaskStatus
                                        ? "hover:shadow-md hover:border-blue-300 cursor-grab active:cursor-grabbing"
                                        : "cursor-default opacity-95"
                                    }`}
                                  >
                                    <div className="flex justify-between items-start gap-2 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => setViewingTask(task)}
                                        className="text-left text-sm font-bold text-gray-900 leading-snug hover:text-blue-600 transition flex-1 focus:outline-none break-all break-words min-w-0"
                                      >
                                        {task.title}
                                      </button>
                                      <span
                                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 ${
                                          task.priority === "high"
                                            ? "bg-red-100 text-red-700 border border-red-200"
                                            : task.priority === "medium"
                                              ? "bg-amber-100 text-amber-700 border border-amber-200"
                                              : "bg-gray-100 text-gray-600 border border-gray-200"
                                        }`}
                                      >
                                        {task.priority}
                                      </span>
                                    </div>

                                  <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed break-all break-words">
                                    {task.description}
                                  </p>

                                  {/* Tags */}
                                  {task.tags && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                      {task.tags.map((tag) => (
                                        <span
                                          key={tag}
                                          className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md text-[10px] font-semibold break-all break-words"
                                        >
                                          #{tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}

                                  {/* Card Footer with Edit Action */}
                                  <div className="border-t border-gray-100 pt-3 mt-1 flex items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center space-x-1.5 min-w-0 text-gray-600">
                                      <span className="h-5 w-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                                        {getAssigneeName(
                                          task.assigneeId,
                                        ).charAt(0)}
                                      </span>
                                      <span className="truncate text-[11px] font-semibold text-gray-700">
                                        {
                                          getAssigneeName(
                                            task.assigneeId,
                                          ).split(" ")[0]
                                        }
                                      </span>
                                    </div>

                                    <div className="flex items-center space-x-2 shrink-0">
                                      <span className="inline-flex items-center text-[11px] font-medium text-gray-500 whitespace-nowrap bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                        📅{" "}
                                        {task.dueDate
                                          ? new Date(
                                              task.dueDate,
                                            ).toString() !== "Invalid Date"
                                            ? new Date(
                                                task.dueDate,
                                              ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                              })
                                            : task.dueDate
                                          : "No date"}
                                      </span>
                                      {isAdmin ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => setEditingTask(task)}
                                            className="rounded-lg bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-blue-600 hover:text-white transition shadow-2xs"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setDeletingTask(task)}
                                            title="Delete Task"
                                            className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-600 hover:text-white transition"
                                          >
                                            <svg
                                              className="w-3.5 h-3.5"
                                              fill="none"
                                              stroke="currentColor"
                                              viewBox="0 0 24 24"
                                              aria-hidden="true"
                                            >
                                              <title>Delete Task</title>
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth="2"
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                              />
                                            </svg>
                                          </button>
                                        </>
                                      ) : canUserUpdateTaskStatus ? (
                                        <select
                                          value={task.status}
                                          onChange={async (e) => {
                                            const newStatus = e.target.value as TaskStatus;
                                            try {
                                              await updateTask({
                                                taskId: task.id,
                                                input: {
                                                  status: newStatus,
                                                  projectId: task.projectId,
                                                },
                                              });
                                              showToast("Task status updated!");
                                            } catch {
                                              showToast("Failed to update status.");
                                            }
                                          }}
                                          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 capitalize cursor-pointer hover:border-blue-400 shadow-2xs"
                                        >
                                          {columns.map((col) => (
                                            <option key={col.status} value={col.status}>
                                              {col.label}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="rounded-lg bg-gray-100 border border-gray-200 px-2 py-1 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                                          {col.label}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </article>
                              );
                            })
                            )}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Unified Multi-Step Create / Edit Task Modal Component */}
        <MultiStepCreateTaskModal
          defaultProjectId={projectId}
          isOpen={isTaskModalOpen || Boolean(editingTask)}
          onClose={() => {
            setIsTaskModalOpen(false);
            setEditingTask(null);
          }}
          onSuccess={showToast}
          editingTask={editingTask}
          availableColumns={columns.map((c) => ({
            status: c.status,
            label: c.label,
          }))}
        />

        {/* Task Detail Information View Modal Component */}
        <TaskDetailModal
          task={viewingTask}
          isOpen={Boolean(viewingTask)}
          onClose={() => setViewingTask(null)}
          onEdit={(taskToEdit) => setEditingTask(taskToEdit)}
          onDelete={(taskToDelete) => setDeletingTask(taskToDelete)}
          members={members}
          projectName={currentProject?.name}
          currentUser={currentUser}
        />

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

        {/* Task Delete Confirmation Modal */}
        {Boolean(deletingTask) && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-gray-100 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Delete Task</h3>
              <p className="text-xs text-gray-600">
                Are you sure you want to delete this task? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingTask(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteTask}
                  disabled={isDeletingTask}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {isDeletingTask ? "Deleting..." : "Delete Task"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Column Modal Component */}
        {isAddColumnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900">
                  Add New Kanban Column
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddColumnModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Enter the name for your custom Kanban column (e.g. Testing, Code
                Review, In Review).
              </p>
              <div>
                <label
                  htmlFor="newColumnNameInput"
                  className="block text-xs font-bold text-gray-700 mb-1"
                >
                  Column Name
                </label>
                <input
                  id="newColumnNameInput"
                  type="text"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  placeholder="e.g. Testing / QA"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddColumnModalOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  Create Column
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
