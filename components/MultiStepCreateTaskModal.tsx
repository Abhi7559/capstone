import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useMembers } from "@/hooks/useMembers";
import { useProjects } from "@/hooks/useProjects";
import { useCreateTask, useUpdateTask } from "@/hooks/useProjectTasks";
import {
  createTaskSchema,
  type MultiStepTaskFormValues,
} from "@/schemas/task.schema";
import type { Task, TaskPriority } from "@/types/task";

interface MultiStepCreateTaskModalProps {
  defaultProjectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
  editingTask?: Task | null;
  availableColumns?: { status: string; label: string }[];
}

export function MultiStepCreateTaskModal({
  defaultProjectId = "",
  isOpen,
  onClose,
  onSuccess,
  editingTask,
  availableColumns,
}: MultiStepCreateTaskModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  const { data: projects } = useProjects();
  const { data: members } = useMembers();

  const {
    createTask,
    isLoading: isCreating,
    error: createError,
    reset: resetCreate,
  } = useCreateTask();

  const {
    updateTask,
    isLoading: isUpdating,
    error: updateError,
    reset: resetUpdate,
  } = useUpdateTask();

  const isLoading = isCreating || isUpdating;
  const error = createError || updateError;

  // Single React Hook Form instance across all steps (Pattern B)
  const {
    register,
    handleSubmit,
    trigger,
    watch,
    reset: resetForm,
    formState: { errors },
  } = useForm<MultiStepTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      projectId: defaultProjectId,
      assigneeId: "",
      dueDate: "",
      tags: "",
      status: "todo",
    },
  });

  const formValues = watch();

  // Reset & Populate form when modal state or editingTarget changes
  useEffect(() => {
    if (isOpen) {
      if (editingTask) {
        resetForm({
          title: editingTask.title || "",
          description: editingTask.description || "",
          priority: editingTask.priority || "medium",
          projectId: editingTask.projectId || defaultProjectId,
          assigneeId: editingTask.assigneeId || "",
          dueDate: editingTask.dueDate || "",
          tags: editingTask.tags ? editingTask.tags.join(", ") : "",
          status: editingTask.status || "todo",
        });
      } else {
        resetForm({
          title: "",
          description: "",
          priority: "medium",
          projectId: defaultProjectId,
          assigneeId: "",
          dueDate: "",
          tags: "",
          status: "todo",
        });
      }
      setCurrentStep(1);
      resetCreate();
      resetUpdate();
    }
  }, [
    isOpen,
    editingTask,
    defaultProjectId,
    resetForm,
    resetCreate,
    resetUpdate,
  ]);

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleNextStep = async () => {
    let isValid = false;
    if (currentStep === 1) {
      isValid = await trigger(["title", "description", "priority"]);
    } else if (currentStep === 2) {
      isValid = await trigger(["projectId", "assigneeId"]);
    } else if (currentStep === 3) {
      isValid = await trigger(["dueDate", "tags"]);
    }

    if (isValid) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4);
    }
  };

  const handleBackStep = () => {
    setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4);
  };

  const handleClose = () => {
    setCurrentStep(1);
    resetForm();
    resetCreate();
    resetUpdate();
    onClose();
  };

  // Submit complete payload only on final step
  const onSubmit = async (data: MultiStepTaskFormValues) => {
    if (currentStep < 4) return;
    try {
      const parsedTags = data.tags
        ? data.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      if (editingTask) {
        await updateTask({
          taskId: editingTask.id,
          input: {
            title: data.title,
            description: data.description,
            priority: data.priority as TaskPriority,
            assigneeId: data.assigneeId || undefined,
            dueDate: data.dueDate || undefined,
            tags: parsedTags,
            status: data.status,
          },
        });
        onSuccess?.("Task updated successfully!");
      } else {
        await createTask({
          projectId: data.projectId,
          title: data.title,
          description: data.description,
          priority: data.priority as TaskPriority,
          status: data.status || "todo",
          assigneeId: data.assigneeId,
          dueDate: data.dueDate,
          tags: parsedTags,
        });
        onSuccess?.("Task created successfully!");
      }

      handleClose();
    } catch {
      // API failure preserves form data & renders error box
    }
  };

  if (!isOpen) return null;

  const selectedProject = projects?.find((p) => p.id === formValues.projectId);
  const selectedAssignee = members?.find((m) => m.id === formValues.assigneeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl h-[580px] max-h-[90vh] flex flex-col rounded-2xl bg-white p-6 shadow-xl border border-gray-100 overflow-hidden">
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {editingTask ? "Edit Task" : "Create New Task"}
            </h2>
            <p className="text-xs text-gray-500">
              Step {currentStep} of 4 —{" "}
              {currentStep === 1
                ? "Task Details"
                : currentStep === 2
                  ? "Assignment"
                  : currentStep === 3
                    ? "Schedule"
                    : "Review & Submit"}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Divider Line Above Step Indicator */}
        <div className="border-t border-gray-400 my-3" />

        {/* Step Progress Indicator Bar */}
        <div className="flex items-center space-x-2 mb-6">
          {[1, 2, 3, 4].map((stepNum) => (
            <div
              key={stepNum}
              className={`flex-1 h-2 rounded-full transition ${
                currentStep >= stepNum ? "bg-blue-600" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Error Notification Banner */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 border border-red-200">
            <p className="text-xs font-semibold text-red-800">{error}</p>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (currentStep === 4) {
              handleSubmit(onSubmit)(e);
            }
          }}
          noValidate
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (currentStep < 4) {
                handleNextStep();
              }
            }
          }}
          className="flex-1 flex flex-col justify-between overflow-y-auto min-h-0"
        >
          {/* STEP 1: Task Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label
                    htmlFor="taskTitle"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Task Title *
                  </label>
                  <span
                    className={`text-xs font-semibold ${(formValues.title?.length || 0) >= 50 ? "text-red-600 font-bold" : "text-gray-400"}`}
                  >
                    {formValues.title?.length || 0}/50
                  </span>
                </div>
                <input
                  id="taskTitle"
                  type="text"
                  placeholder="e.g. Implement Multi-Step Form"
                  maxLength={50}
                  className={`w-full rounded-lg border px-3.5 py-2 text-sm outline-none transition focus:ring-2 ${
                    errors.title || (formValues.title?.length || 0) >= 50
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-gray-500 focus:ring-gray-100"
                  }`}
                  {...register("title")}
                />
                {errors.title ? (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {errors.title.message}
                  </p>
                ) : (formValues.title?.length || 0) >= 50 ? (
                  <p className="mt-1 text-xs text-red-600 font-medium flex items-center gap-1">
                    <span>⚠️</span> Maximum limit of 50 characters reached
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="taskDescription"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description *
                </label>
                <textarea
                  id="taskDescription"
                  rows={3}
                  placeholder="Describe task scope and acceptance criteria..."
                  className={`w-full rounded-lg border px-3.5 py-2 text-sm outline-none transition focus:ring-2 ${
                    errors.description
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-gray-500 focus:ring-gray-100"
                  }`}
                  {...register("description")}
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {errors.description.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="taskPriority"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Priority *
                  </label>
                  <select
                    id="taskPriority"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-100"
                    {...register("priority")}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  {errors.priority && (
                    <p className="mt-1 text-xs text-red-600 font-medium">
                      {errors.priority.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="taskStatus"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Initial Column / Status
                  </label>
                  <select
                    id="taskStatus"
                    className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-100 capitalize"
                    {...register("status")}
                  >
                    {(
                      availableColumns || [
                        { status: "backlog", label: "BACKLOG" },
                        { status: "todo", label: "TO DO" },
                        { status: "in_progress", label: "IN PROGRESS" },
                        { status: "done", label: "COMPLETED" },
                      ]
                    ).map((col) => (
                      <option key={col.status} value={col.status}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Assignment */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="taskProject"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Target Project *
                </label>
                <select
                  id="taskProject"
                  className={`w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:ring-2 ${
                    errors.projectId
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-gray-500 focus:ring-gray-100"
                  }`}
                  {...register("projectId")}
                >
                  <option value="">Select a project...</option>
                  {projects?.map((proj) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name} ({proj.status})
                    </option>
                  ))}
                </select>
                {errors.projectId && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {errors.projectId.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="taskAssignee"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Assignee *
                </label>
                <select
                  id="taskAssignee"
                  className={`w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:ring-2 ${
                    errors.assigneeId
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-gray-500 focus:ring-gray-100"
                  }`}
                  {...register("assigneeId")}
                >
                  <option value="">Select an assignee...</option>
                  {members?.map((mem) => (
                    <option key={mem.id} value={mem.id}>
                      {mem.name} ({mem.email})
                    </option>
                  ))}
                </select>
                {errors.assigneeId && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {errors.assigneeId.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: Schedule & Tags */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="taskDueDate"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Due Date *
                </label>
                <input
                  id="taskDueDate"
                  type="date"
                  className={`w-full rounded-lg border px-3.5 py-2 text-sm outline-none focus:ring-2 ${
                    errors.dueDate
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-300 focus:border-gray-500 focus:ring-gray-100"
                  }`}
                  {...register("dueDate")}
                />
                {errors.dueDate && (
                  <p className="mt-1 text-xs text-red-600 font-medium">
                    {errors.dueDate.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="taskTags"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tags (Comma Separated)
                </label>
                <input
                  id="taskTags"
                  type="text"
                  placeholder="e.g. Frontend, Auth, Priority"
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-gray-100"
                  {...register("tags")}
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  Enter tags separated by commas.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Final Submit */}
          {currentStep === 4 && (
            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
              <h3 className="text-sm font-bold text-gray-800 border-b pb-2">
                Review Task Details
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Title:</span>
                  <p className="font-semibold text-gray-900 break-all break-words">
                    {formValues.title}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Priority:</span>
                  <p className="font-semibold text-gray-900 uppercase">
                    {formValues.priority}
                  </p>
                </div>
                <div className="col-span-2 min-w-0">
                  <span className="text-gray-500">Description:</span>
                  <p className="font-medium text-gray-800 break-all break-words whitespace-pre-wrap">
                    {formValues.description}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Project:</span>
                  <p className="font-semibold text-gray-900">
                    {selectedProject?.name || formValues.projectId}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Assignee:</span>
                  <p className="font-semibold text-gray-900">
                    {selectedAssignee?.name || formValues.assigneeId}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Due Date:</span>
                  <p className="font-semibold text-gray-900">
                    {formValues.dueDate}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Tags:</span>
                  <p className="font-semibold text-gray-900">
                    {formValues.tags || "None"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Divider Line Above Footer Controls */}
          <div className="border-t border-gray-400 my-4" />

          {/* Footer Controls */}
          <div className="flex justify-between items-center pt-2">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBackStep}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentStep === 4) {
                    handleSubmit(onSubmit)();
                  }
                }}
                disabled={isLoading}
                className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white hover:bg-green-700 transition disabled:opacity-50"
              >
                {isLoading
                  ? editingTask
                    ? "Saving Task..."
                    : "Creating Task..."
                  : editingTask
                    ? "Update Task"
                    : "Create Task"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
