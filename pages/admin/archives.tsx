import Head from "next/head";
import { useRouter } from "next/router";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useMembers } from "@/hooks/useMembers";
import { useProjects, useRestoreProject } from "@/hooks/useProjects";
import { useRestoreTask, useTasks } from "@/hooks/useProjectTasks";
import { useAuthStore } from "@/store/useAuthStore";
import type { Project } from "@/types/project";
import type { Task } from "@/types/task";

export default function ArchivesPage() {
  const router = useRouter();
  const initialTab = router.query.tab === "tasks" ? "tasks" : "projects";
  const [activeTab, setActiveTab] = useState<"projects" | "tasks">(initialTab);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [taskToRestore, setTaskToRestore] = useState<Task | null>(null);

  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === "admin";

  const { data: allActiveProjects } = useProjects();
  const { data: deletedProjects, isLoading: isProjectsLoading } = useProjects({
    deletedOnly: true,
  });
  const { data: members } = useMembers();
  const { data: activeTasks } = useTasks();
  const { data: deletedTasks, isLoading: isTasksLoading } = useTasks(
    undefined,
    {
      deletedOnly: true,
    },
  );

  const { restoreProject } = useRestoreProject();
  const { restoreTask } = useRestoreTask();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Show ONLY soft-deleted (trash) projects
  const archivedProjects: (Project & { isSoftDeleted?: boolean })[] = (() => {
    const list: (Project & { isSoftDeleted?: boolean })[] = [];
    const seenIds = new Set<string>();

    (deletedProjects || []).forEach((p) => {
      if (!seenIds.has(p.id)) {
        seenIds.add(p.id);
        list.push({ ...p, isSoftDeleted: true });
      }
    });

    return list;
  })();

  // Show ONLY soft-deleted (trash) tasks
  const archivedTasks: Task[] = (() => {
    const list: Task[] = [];
    const seenIds = new Set<string>();

    (deletedTasks || []).forEach((t) => {
      if (!seenIds.has(t.id)) {
        seenIds.add(t.id);
        list.push(t);
      }
    });

    return list;
  })();

  const getMemberInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email && email.trim()) {
      return email.slice(0, 2).toUpperCase();
    }
    return "??";
  };

  const getMemberDetails = (memberId: string) => {
    return members?.find((m) => m.id === memberId);
  };

  const handleRestoreProject = async (
    project: Project & { isSoftDeleted?: boolean },
  ) => {
    setRestoringId(project.id);
    try {
      await restoreProject(project.id);
      showToast(`Project "${project.name}" restored successfully!`);
    } catch (err: any) {
      showToast(err?.message || "Failed to restore project.");
    } finally {
      setRestoringId(null);
    }
  };

  const handleRestoreTask = async (task: Task) => {
    setRestoringId(task.id);
    try {
      await restoreTask(task.id);
      showToast(`Task "${task.title}" restored successfully!`);
      setTaskToRestore(null);
    } catch (err: any) {
      showToast(err?.message || "Failed to restore task.");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["admin", "member"]}>
      <Head>
        <title>Archives — WorkStream Workspace</title>
      </Head>

      <div className="flex min-h-screen bg-slate-50/50 font-sans">
        <Sidebar
          activeTab="archives"
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            title="Archives"
            onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          />

          {/* Toast Notification Banner */}
          {toastMessage && (
            <div className="fixed top-5 right-5 z-50 rounded-xl bg-slate-900 text-white px-4 py-3 text-sm shadow-xl flex items-center space-x-2 animate-fade-in border border-slate-700">
              <span className="text-emerald-400">✓</span>
              <span>{toastMessage}</span>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                Archives
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Restore archived projects and tasks.
              </p>
            </div>

            {/* Tab Pill Buttons */}
            <div className="flex items-center space-x-3 mb-6">
              <button
                type="button"
                onClick={() => setActiveTab("projects")}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition cursor-pointer shadow-xs ${
                  activeTab === "projects"
                    ? "bg-purple-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Projects ({archivedProjects.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("tasks")}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition cursor-pointer shadow-xs ${
                  activeTab === "tasks"
                    ? "bg-purple-600 text-white"
                    : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                }`}
              >
                Tasks ({archivedTasks.length})
              </button>
            </div>

            {/* Table Container Card */}
            <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xs overflow-hidden">
              {activeTab === "projects" ? (
                /* ─── Projects Table ─── */
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/40 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        <th className="py-3.5 px-6">Project</th>
                        <th className="py-3.5 px-6">Description</th>
                        <th className="py-3.5 px-6">Members</th>
                        <th className="py-3.5 px-6">Tasks</th>
                        <th className="py-3.5 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {isProjectsLoading ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-12 text-center text-gray-400"
                          >
                            Loading archived projects...
                          </td>
                        </tr>
                      ) : archivedProjects.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-16 text-center text-gray-400"
                          >
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <span className="text-3xl">📦</span>
                              <p className="font-medium text-gray-600">
                                No archived projects
                              </p>
                              <p className="text-xs text-gray-400">
                                Projects marked as archived will appear here for
                                recovery.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        archivedProjects.map((project) => {
                          const projectTaskCount = (
                            allActiveProjects || []
                          ).concat(deletedProjects || []).length
                            ? (activeTasks || []).filter(
                                (t) => t.projectId === project.id,
                              ).length
                            : 0;

                          const assignedMembers = (project.memberIds || [])
                            .map(getMemberDetails)
                            .filter(Boolean);

                          return (
                            <tr
                              key={project.id}
                              className="hover:bg-slate-50/60 transition group"
                            >
                              {/* PROJECT NAME */}
                              <td className="py-4 px-6 font-semibold text-gray-900 whitespace-nowrap">
                                <div className="flex items-center space-x-2.5">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 text-sm border border-purple-200 flex-shrink-0">
                                    📁
                                  </span>
                                  <span className="hover:text-purple-600 transition truncate max-w-[200px] sm:max-w-xs">
                                    {project.name}
                                  </span>
                                </div>
                              </td>

                              {/* DESCRIPTION */}
                              <td className="py-4 px-6 text-gray-500 text-xs max-w-sm truncate">
                                {project.description || "—"}
                              </td>

                              {/* MEMBERS */}
                              <td className="py-4 px-6 whitespace-nowrap">
                                {assignedMembers.length === 0 ? (
                                  <span className="text-xs text-gray-400">
                                    —
                                  </span>
                                ) : (
                                  <div className="flex items-center -space-x-1.5 overflow-hidden">
                                    {assignedMembers
                                      .slice(0, 3)
                                      .map((m, idx) => (
                                        <div
                                          key={m?.id || idx}
                                          title={m?.name || m?.email}
                                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white ${
                                            idx % 2 === 0
                                              ? "bg-blue-600"
                                              : "bg-purple-600"
                                          }`}
                                        >
                                          {getMemberInitials(m?.name, m?.email)}
                                        </div>
                                      ))}
                                    {assignedMembers.length > 3 && (
                                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700 ring-2 ring-white">
                                        +{assignedMembers.length - 3}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* TASKS COUNT */}
                              <td className="py-4 px-6 text-xs font-semibold text-gray-700 whitespace-nowrap">
                                {projectTaskCount}
                              </td>

                              {/* ACTION BUTTON */}
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={restoringId === project.id}
                                  onClick={() => handleRestoreProject(project)}
                                  className="inline-flex items-center space-x-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs transition hover:bg-gray-50 hover:border-gray-400 cursor-pointer disabled:opacity-50"
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 text-gray-500 ${
                                      restoringId === project.id
                                        ? "animate-spin"
                                        : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <title>Restore Project</title>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  <span>Restore</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* ─── Tasks Table ─── */
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/40 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        <th className="py-3.5 px-6">Task</th>
                        <th className="py-3.5 px-6">Project</th>
                        <th className="py-3.5 px-6">Description</th>
                        <th className="py-3.5 px-6">Assignee</th>
                        <th className="py-3.5 px-6">Status / Priority</th>
                        <th className="py-3.5 px-6 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {isTasksLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-gray-400"
                          >
                            Loading archived tasks...
                          </td>
                        </tr>
                      ) : archivedTasks.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-16 text-center text-gray-400"
                          >
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <span className="text-3xl">🗑️</span>
                              <p className="font-medium text-gray-600">
                                No archived tasks
                              </p>
                              <p className="text-xs text-gray-400">
                                Soft-deleted or archived tasks will appear here
                                for recovery.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        archivedTasks.map((task) => {
                          const project = (allActiveProjects || [])
                            .concat(deletedProjects || [])
                            .find((p) => p.id === task.projectId);
                          const assignee = task.assigneeId
                            ? getMemberDetails(task.assigneeId)
                            : null;

                          return (
                            <tr
                              key={task.id}
                              className="hover:bg-slate-50/60 transition group"
                            >
                              {/* TASK TITLE */}
                              <td className="py-4 px-6 font-semibold text-gray-900 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <span className="text-purple-600 text-sm">
                                    📋
                                  </span>
                                  <span className="truncate max-w-[180px] sm:max-w-xs">
                                    {task.title}
                                  </span>
                                </div>
                              </td>

                              {/* PROJECT NAME */}
                              <td className="py-4 px-6 text-xs text-gray-600 whitespace-nowrap">
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                                  {project?.name || "Unknown Project"}
                                </span>
                              </td>

                              {/* DESCRIPTION */}
                              <td className="py-4 px-6 text-gray-500 text-xs max-w-xs truncate">
                                {task.description || "—"}
                              </td>

                              {/* ASSIGNEE */}
                              <td className="py-4 px-6 whitespace-nowrap text-xs text-gray-700">
                                {assignee ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                                      {getMemberInitials(
                                        assignee.name,
                                        assignee.email,
                                      )}
                                    </div>
                                    <span className="truncate max-w-[120px]">
                                      {assignee.name || assignee.email}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic">
                                    Unassigned
                                  </span>
                                )}
                              </td>

                              {/* STATUS / PRIORITY */}
                              <td className="py-4 px-6 whitespace-nowrap">
                                <div className="flex items-center space-x-1.5">
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                      task.priority === "high"
                                        ? "bg-red-100 text-red-700"
                                        : task.priority === "medium"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                  <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase border border-purple-200">
                                    {task.status.replace("_", " ")}
                                  </span>
                                </div>
                              </td>

                              {/* ACTION BUTTON */}
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                <button
                                  type="button"
                                  disabled={restoringId === task.id}
                                  onClick={() => setTaskToRestore(task)}
                                  className="inline-flex items-center space-x-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs transition hover:bg-gray-50 hover:border-gray-400 cursor-pointer disabled:opacity-50"
                                >
                                  <svg
                                    className={`w-3.5 h-3.5 text-gray-500 ${
                                      restoringId === task.id
                                        ? "animate-spin"
                                        : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                  >
                                    <title>Restore Task</title>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  <span>Restore</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Task Restore Confirmation Modal */}
        {Boolean(taskToRestore) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 text-lg border border-emerald-200">
                  🔄
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Restore Task
                  </h3>
                  <p className="text-xs text-gray-500">
                    Return task to active Kanban board
                  </p>
                </div>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Are you sure you want to restore{" "}
                <strong className="text-gray-900">
                  "{taskToRestore?.title}"
                </strong>{" "}
                back to the active task board?
              </p>
              <div className="flex justify-end space-x-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  disabled={restoringId === taskToRestore?.id}
                  onClick={() => setTaskToRestore(null)}
                  className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    taskToRestore && handleRestoreTask(taskToRestore)
                  }
                  disabled={restoringId === taskToRestore?.id}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm cursor-pointer"
                >
                  {restoringId === taskToRestore?.id
                    ? "Restoring..."
                    : "Confirm Restore"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
