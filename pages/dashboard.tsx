import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useMembers } from "@/hooks/useMembers";
import { useProjects } from "@/hooks/useProjects";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  AdminDashboardData,
  MemberDashboardData,
} from "@/types/dashboard";

export default function DashboardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.currentUser);
  const isAdmin = currentUser?.role === "admin";

  const { data: dashboardData, isLoading, isError, error } = useDashboardData();
  const { data: projects } = useProjects();
  const { data: members } = useMembers();

  const adminData = isAdmin ? (dashboardData as AdminDashboardData) : null;
  const memberData = !isAdmin ? (dashboardData as MemberDashboardData) : null;

  const getProjectName = (projectId: string) => {
    const p = projects?.find((proj) => proj.id === projectId);
    return p ? p.name : "Project";
  };

  const getAssigneeName = (assigneeId: string) => {
    if (assigneeId === currentUser?.id) return `${currentUser.name} (You)`;
    const m = members?.find((mem) => mem.id === assigneeId);
    return m ? m.name : "Unassigned";
  };

  const formatRelativeTime = (isoString: string) => {
    if (!isoString) return "";
    const created = new Date(isoString).getTime();
    if (Number.isNaN(created)) return isoString;

    const now = Date.now();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} ${diffMins === 1 ? "minute" : "minutes"} ago`;
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
    if (diffDays === 1) return "Yesterday";
    return `${diffDays} days ago`;
  };

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (router.query.loggedIn && currentUser) {
      const roleName = currentUser.role === "admin" ? "Admin" : "Member";
      setToastMessage(
        `Welcome back, ${currentUser.name}! Logged in as ${roleName}.`,
      );
      router.replace("/dashboard", undefined, { shallow: true });
    }
  }, [router.query.loggedIn, currentUser, router]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-100 font-sans">
        <Sidebar
          activeTab="dashboard"
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Bar Header */}
          <TopBar onMobileMenuToggle={() => setIsMobileSidebarOpen(true)} />

          {/* Scrollable Page Body */}
          <main className="flex-1 p-8 overflow-y-auto">
            {/* Dashboard Welcome Header */}
            <header className="mb-8 pb-4 border-b border-gray-200">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Welcome back, {currentUser?.name || "User"}! 👋
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {isAdmin
                    ? "Overview of workspace health, total tasks, and operational activity."
                    : "Overview of your assigned tasks, upcoming deadlines, and team projects."}
                </p>
              </div>
            </header>

            {/* Loading / Error States */}
            {isLoading ? (
              <div className="p-12 text-center text-gray-500 font-medium">
                Loading dashboard metrics...
              </div>
            ) : isError ? (
              <div className="rounded-xl bg-red-50 p-6 text-center border border-red-200 text-red-700 font-medium">
                {error
                  ? (error as Error).message
                  : "Failed to load dashboard data."}
              </div>
            ) : isAdmin && adminData ? (
              /* ADMIN DASHBOARD UI */
              <div className="space-y-8">
                {/* Metric Summary Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Total Projects
                    </h3>
                    <p className="text-3xl font-extrabold text-gray-900">
                      {adminData.totalProjects}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Total Tasks
                    </h3>
                    <p className="text-3xl font-extrabold text-gray-900">
                      {adminData.totalTasks}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Completed Tasks
                    </h3>
                    <p className="text-3xl font-extrabold text-green-600">
                      {adminData.completedTasks}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Overdue Tasks
                    </h3>
                    <p className="text-3xl font-extrabold text-red-600">
                      {adminData.overdueTasks}
                    </p>
                  </div>
                </div>

                {/* Recently Created Tasks Section */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="text-base font-bold text-gray-900">
                      Recently Created Tasks
                    </h3>
                    <button
                      type="button"
                      onClick={() => router.push("/projects")}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                    >
                      View All Tasks →
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="p-8 text-center text-xs text-gray-400 font-medium">
                      Loading recently created tasks...
                    </div>
                  ) : isError ? (
                    <div className="p-4 text-center rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center justify-between">
                      <span>Unable to load recently created tasks.</span>
                      <button
                        type="button"
                        onClick={() => {
                          queryClient.invalidateQueries({
                            queryKey: ["dashboardData"],
                          });
                        }}
                        className="underline font-bold hover:text-red-900"
                      >
                        Retry
                      </button>
                    </div>
                  ) : !adminData.recentlyCreatedTasks ||
                    adminData.recentlyCreatedTasks.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-400 font-medium">
                      No tasks have been created yet.
                    </div>
                  ) : (
                    <>
                      {/* Desktop / Tablet Table View */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left text-xs text-gray-600">
                          <thead className="bg-gray-50 text-gray-400 uppercase font-semibold text-[11px] border-b border-gray-100">
                            <tr>
                              <th className="px-4 py-3">Task</th>
                              <th className="px-4 py-3">Project</th>
                              <th className="px-4 py-3">Assignee</th>
                              <th className="px-4 py-3">Priority</th>
                              <th className="px-4 py-3">Status</th>
                              <th className="px-4 py-3">Due Date</th>
                              <th className="px-4 py-3 text-right">Created</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-medium">
                            {adminData.recentlyCreatedTasks.map((task) => (
                              <tr
                                key={task.id}
                                className="hover:bg-gray-50/70 transition"
                              >
                                <td className="px-4 py-3.5 font-bold text-gray-900 max-w-[200px] break-all break-words min-w-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      router.push(`/projects/${task.projectId}`)
                                    }
                                    className="hover:text-blue-600 text-left transition break-all break-words line-clamp-2"
                                  >
                                    {task.title}
                                  </button>
                                </td>
                                <td className="px-4 py-3.5 text-gray-600 max-w-[150px] break-all break-words min-w-0">
                                  📁 {getProjectName(task.projectId)}
                                </td>
                                <td className="px-4 py-3.5 text-gray-700">
                                  👤 {getAssigneeName(task.assigneeId)}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                      task.priority === "high"
                                        ? "bg-red-100 text-red-700"
                                        : task.priority === "medium"
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border capitalize ${
                                      task.status === "done"
                                        ? "bg-green-50 border-green-200 text-green-700"
                                        : task.status === "in_progress"
                                          ? "bg-blue-50 border-blue-200 text-blue-700"
                                          : "bg-gray-50 border-gray-200 text-gray-600"
                                    }`}
                                  >
                                    {task.status === "in_progress"
                                      ? "In Progress"
                                      : task.status === "done"
                                        ? "Done"
                                        : "To Do"}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 text-gray-600">
                                  {task.dueDate}
                                </td>
                                <td className="px-4 py-3.5 text-gray-400 text-right text-[11px]">
                                  {formatRelativeTime(task.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Stacked Card View */}
                      <div className="sm:hidden space-y-3">
                        {adminData.recentlyCreatedTasks.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-lg border border-gray-200 bg-gray-50/50 p-4 space-y-2 text-xs"
                          >
                            <div className="flex justify-between items-start">
                              <button
                                type="button"
                                onClick={() =>
                                  router.push(`/projects/${task.projectId}`)
                                }
                                className="font-bold text-gray-900 text-sm text-left hover:text-blue-600 break-all break-words min-w-0"
                              >
                                {task.title}
                              </button>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                  task.priority === "high"
                                    ? "bg-red-100 text-red-700"
                                    : task.priority === "medium"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>

                            <div className="flex justify-between text-gray-500 text-[11px]">
                              <span>📁 {getProjectName(task.projectId)}</span>
                              <span>👤 {getAssigneeName(task.assigneeId)}</span>
                            </div>

                            <div className="pt-2 border-t border-gray-200/60 flex justify-between items-center text-[11px]">
                              <span
                                className={`inline-flex items-center rounded px-2 py-0.5 font-bold border capitalize ${
                                  task.status === "done"
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : task.status === "in_progress"
                                      ? "bg-blue-50 border-blue-200 text-blue-700"
                                      : "bg-gray-50 border-gray-200 text-gray-600"
                                }`}
                              >
                                {task.status === "in_progress"
                                  ? "In Progress"
                                  : task.status === "done"
                                    ? "Done"
                                    : "To Do"}
                              </span>
                              <span className="text-gray-400">
                                {formatRelativeTime(task.createdAt)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : memberData ? (
              /* MEMBER DASHBOARD UI (Personal Workspace Overview) */
              <div className="space-y-8">
                {/* Metric Summary Cards */}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      My Assigned Tasks
                    </h3>
                    <p className="text-3xl font-extrabold text-blue-600">
                      {memberData.myAssignedTasks.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Overdue Items
                    </h3>
                    <p className="text-3xl font-extrabold text-red-600">
                      {memberData.myOverdueTasks.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      Tasks Due Soon
                    </h3>
                    <p className="text-3xl font-extrabold text-amber-600">
                      {memberData.tasksDueSoon.length}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
                      My Projects
                    </h3>
                    <p className="text-3xl font-extrabold text-purple-600">
                      {memberData.myProjects.length}
                    </p>
                  </div>
                </div>

                {/* Overdue Items Alert Section (if any) */}
                {memberData.myOverdueTasks.length > 0 && (
                  <div className="rounded-xl border border-red-200 bg-red-50/70 p-6 shadow-sm space-y-3">
                    <div className="flex items-center space-x-2 text-red-800 font-bold text-sm">
                      <span>⚠️</span>
                      <h3>
                        Overdue Action Items ({memberData.myOverdueTasks.length}
                        )
                      </h3>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {memberData.myOverdueTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex justify-between items-center bg-white p-3.5 rounded-lg border border-red-200 shadow-sm text-xs"
                        >
                          <div>
                            <p className="font-bold text-gray-900 break-all break-words">
                              {task.title}
                            </p>
                            <p className="text-[11px] text-gray-500 line-clamp-1 break-all break-words">
                              {task.description}
                            </p>
                          </div>
                          <span className="font-semibold text-red-700 bg-red-100 px-2 py-1 rounded text-[10px]">
                            Due: {task.dueDate}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section: My Assigned Tasks */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <h3 className="text-base font-bold text-gray-900">
                      My Assigned Tasks ({memberData.myAssignedTasks.length})
                    </h3>
                  </div>

                  {memberData.myAssignedTasks.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      You currently have no tasks assigned.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {memberData.myAssignedTasks.map((task) => {
                        const targetProj = memberData.myProjects.find(
                          (p) => p.id === task.projectId,
                        );

                        return (
                          <div
                            key={task.id}
                            className="flex flex-col justify-between rounded-lg border border-gray-200 bg-gray-50/50 p-4 hover:border-blue-200 transition space-y-2 text-xs"
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-gray-900 text-sm break-all break-words min-w-0">
                                {task.title}
                              </h4>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                  task.priority === "high"
                                    ? "bg-red-100 text-red-700"
                                    : task.priority === "medium"
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {task.priority}
                              </span>
                            </div>

                            <p className="text-gray-600 line-clamp-2">
                              {task.description}
                            </p>

                            <div className="border-t border-gray-200/80 pt-2 flex justify-between items-center text-[11px] text-gray-500">
                              <span className="font-medium text-gray-700">
                                📁 {targetProj?.name || "Project"}
                              </span>
                              <span className="font-semibold text-gray-800">
                                Due: {task.dueDate}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Projects I Belong To List */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-4 border-b pb-3">
                    Projects Across My Workspace
                  </h3>
                  {memberData.myProjects.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      You are not assigned to any projects yet.
                    </p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {memberData.myProjects.map((proj) => (
                        <button
                          key={proj.id}
                          type="button"
                          onClick={() => router.push(`/projects/${proj.id}`)}
                          className="text-left w-full rounded-lg border border-gray-200 bg-gray-50/50 p-4 hover:bg-blue-50/30 hover:border-blue-200 cursor-pointer transition"
                        >
                          <h4 className="text-sm font-bold text-gray-900 mb-1 break-all break-words">
                            {proj.name}
                          </h4>
                          <p className="text-xs text-gray-500 line-clamp-2 break-all break-words">
                            {proj.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </main>
        </div>

        {/* Top-Center Floating Login Toast Notification */}
        {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center space-x-3 rounded-full bg-slate-900/90 backdrop-blur-md text-white px-5 py-2.5 text-xs font-semibold shadow-2xl border border-slate-700/50 animate-in fade-in slide-in-from-top-4 duration-200">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
