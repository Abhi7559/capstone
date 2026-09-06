import { useEffect } from "react";
import type { User } from "@/types/auth";
import type { Task } from "@/types/task";

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (task: Task) => void;
  onDelete?: (task: Task) => void;
  members?: User[];
  projectName?: string;
  currentUser?: User | null;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  members,
  projectName,
  currentUser,
}: TaskDetailModalProps) {
  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen && task) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const assignee = members?.find((m) => m.id === task.assigneeId);
  const assigneeName =
    task.assigneeId === currentUser?.id
      ? `${currentUser.name} (You)`
      : assignee
        ? assignee.name
        : "Unassigned";
  const assigneeEmail =
    task.assigneeId === currentUser?.id
      ? currentUser.email
      : assignee?.email || "N/A";

  const formattedDueDate = task.dueDate
    ? new Date(task.dueDate).toString() !== "Invalid Date"
      ? new Date(task.dueDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : task.dueDate
    : "No due date";

  const formattedCreatedDate = task.createdAt
    ? new Date(task.createdAt).toString() !== "Invalid Date"
      ? new Date(task.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : task.createdAt
    : "N/A";

  const formattedUpdatedDate = task.updatedAt
    ? new Date(task.updatedAt).toString() !== "Invalid Date"
      ? new Date(task.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : task.updatedAt
    : "N/A";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 font-sans">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 space-y-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-start pb-4 border-b border-gray-100">
          <div className="space-y-1 pr-4">
            {projectName && (
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                {projectName}
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900 leading-snug mt-1 break-all break-words">
              {task.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg p-1 rounded-lg hover:bg-gray-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-500">Status:</span>
          <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-0.5 text-xs font-bold uppercase tracking-wider border border-blue-200">
            {task.status.replace("_", " ")}
          </span>

          <span className="font-semibold text-gray-500 ml-2">Priority:</span>
          <span
            className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider ${
              task.priority === "high"
                ? "bg-red-100 text-red-700 border border-red-200"
                : task.priority === "medium"
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-gray-100 text-gray-700 border border-gray-200"
            }`}
          >
            {task.priority}
          </span>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
            Description
          </h3>
          <div className="rounded-xl bg-gray-50/80 p-4 border border-gray-100 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-all break-words">
            {task.description || "No task description provided."}
          </div>
        </div>

        {/* Task Details Grid */}
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-gray-100 bg-white p-4 text-xs">
          {/* Assignee */}
          <div className="space-y-1">
            <span className="font-medium text-gray-400 uppercase text-[10px] tracking-wider block">
              Assigned To
            </span>
            <div className="flex items-center space-x-2">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center uppercase shadow-xs">
                {assigneeName.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-900 leading-tight">
                  {assigneeName}
                </p>
                <p className="text-[11px] text-gray-500">{assigneeEmail}</p>
              </div>
            </div>
          </div>

          {/* Due Date */}
          <div className="space-y-1">
            <span className="font-medium text-gray-400 uppercase text-[10px] tracking-wider block">
              Due Date
            </span>
            <div className="flex items-center space-x-1.5 pt-1">
              <span className="text-base">📅</span>
              <span className="font-bold text-gray-900">
                {formattedDueDate}
              </span>
            </div>
          </div>

          {/* Created Date */}
          <div className="space-y-1 border-t border-gray-100 pt-3">
            <span className="font-medium text-gray-400 uppercase text-[10px] tracking-wider block">
              Created Date
            </span>
            <p className="font-semibold text-gray-800">
              {formattedCreatedDate}
            </p>
          </div>

          {/* Updated Date */}
          <div className="space-y-1 border-t border-gray-100 pt-3">
            <span className="font-medium text-gray-400 uppercase text-[10px] tracking-wider block">
              Last Updated
            </span>
            <p className="font-semibold text-gray-800">
              {formattedUpdatedDate}
            </p>
          </div>
        </div>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-xs font-semibold"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-100">
          <div>
            {currentUser?.role === "admin" && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(task);
                }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 hover:text-red-700 transition"
              >
                🗑️ Delete Task
              </button>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {currentUser?.role === "admin" && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(task);
                }}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 transition"
              >
                Edit Task Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
