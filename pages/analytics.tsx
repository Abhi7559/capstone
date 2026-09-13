import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { useAnalyticsData } from "@/hooks/useAnalyticsData";
import { useProjects } from "@/hooks/useProjects";

export default function AnalyticsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const { data: projects = [] } = useProjects();

  const {
    isLoading,
    isError,
    error,
    hasTasks,
    tasksByStatus,
    tasksByAssignee,
    completionTrend,
  } = useAnalyticsData(selectedProjectId);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const renderPieLabel = ({
    name,
    value,
  }: {
    name?: string;
    value?: number;
  }) => {
    if (!value || value <= 0) return null;
    return `${name}: ${value}`;
  };

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-100 font-sans">
        <Sidebar
          activeTab="analytics"
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            title="Analytics"
            onMobileMenuToggle={() => setIsMobileSidebarOpen(true)}
          />

          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
            {/* Project Filter Section */}
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Analytics Overview
                </h2>
                <p className="text-xs text-gray-500">
                  Filter task metrics by project or view workspace aggregates.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <label
                  htmlFor="project-filter-select"
                  className="text-xs font-bold text-gray-700 whitespace-nowrap"
                >
                  Project:
                </label>
                <select
                  id="project-filter-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-xs focus:border-blue-500 focus:outline-hidden cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* UI States: Loading / Error / Empty / Success */}
            {isLoading ? (
              <div className="p-12 text-center text-gray-500 font-medium">
                Loading analytics charts...
              </div>
            ) : isError ? (
              <div className="rounded-xl bg-red-50 p-6 text-center border border-red-200 text-red-700 flex flex-col items-center justify-center space-y-3">
                <p className="text-sm font-semibold">
                  {error
                    ? error
                    : "Unable to load analytics metrics data at this time. Please try again."}
                </p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition cursor-pointer shadow-xs"
                >
                  Retry Page
                </button>
              </div>
            ) : !hasTasks ? (
              <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500 font-medium">
                {selectedProjectId !== "all"
                  ? "No task data available for this project."
                  : "No task data available to render charts."}
              </div>
            ) : (
              <div className="space-y-8">
                {/* 1. Pie Chart: Tasks by Status */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-gray-900">
                      Tasks by Status
                    </h3>
                    <p className="text-xs text-gray-500">
                      Distribution across Todo, In Progress, and Done workflow
                      statuses.
                    </p>
                  </div>
                  <div className="w-full h-80">
                    {(() => {
                      const activeStatusSlices = tasksByStatus.filter(
                        (s) => s.value > 0,
                      );

                      if (activeStatusSlices.length === 0) {
                        return (
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center text-xs text-gray-500">
                            No tasks created yet in this workspace. Create tasks
                            to view status distribution.
                          </div>
                        );
                      }

                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={activeStatusSlices}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={100}
                              label={renderPieLabel}
                              activeShape={false}
                            >
                              {activeStatusSlices.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* 2. Bar Chart: Tasks by Assignee */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-gray-900">
                      Tasks by Assignee
                    </h3>
                    <p className="text-xs text-gray-500">
                      Workload allocation and task count per team member.
                    </p>
                  </div>
                  <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tasksByAssignee}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip
                          cursor={false}
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderColor: "#e5e7eb",
                            borderRadius: "12px",
                            boxShadow:
                              "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                            fontSize: "12px",
                            padding: "10px 14px",
                          }}
                        />
                        <Bar
                          dataKey="tasksCount"
                          name="Assigned Tasks"
                          fill="#3b82f6"
                          radius={[6, 6, 0, 0]}
                          barSize={32}
                          activeBar={{
                            fill: "#2563eb",
                            stroke: "#1d4ed8",
                            strokeWidth: 1,
                            style: {
                              filter:
                                "drop-shadow(0px 8px 12px rgba(37, 99, 235, 0.45))",
                            },
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 3. Line Chart: Completion Trend */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-gray-900">
                      Completion Trend
                    </h3>
                    <p className="text-xs text-gray-500">
                      Cumulative completed task volume over the past 7 days.
                    </p>
                  </div>
                  <div className="w-full h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={completionTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="completedCount"
                          name="Completed Tasks"
                          stroke="#22c55e"
                          strokeWidth={3}
                          dot={{ r: 5 }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
