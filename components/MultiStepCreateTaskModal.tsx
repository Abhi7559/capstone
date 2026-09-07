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
    setValue,
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

        {/* Step Progress Indicator Bar */}
        <div className="flex items-center space-x-2 mb-6">
          {[1, 2, 3, 4].map((stepNum) => {
            const isTaskTitleValid = Boolean(formValues.title && formValues.title.trim().length >= 3);
            const isActive = stepNum < currentStep || (stepNum === currentStep && (currentStep > 1 || isTaskTitleValid));
            return (
              <div
                key={stepNum}
                className={`flex-1 h-2 rounded-full transition ${
                  isActive ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            );
          })}
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
                <div className="min-h-[18px] mt-1">
                  {errors.title ? (
                    <p className="text-xs text-red-600 font-medium">
                      {errors.title.message}
                    </p>
                  ) : (formValues.title?.length || 0) >= 50 ? (
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <span>⚠️</span> Maximum limit of 50 characters reached
                    </p>
                  ) : null}
                </div>
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
                <div className="min-h-[18px] mt-1">
                  {errors.description && (
                    <p className="text-xs text-red-600 font-medium">
                      {errors.description.message}
                    </p>
                  )}
                </div>
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
                  <div className="min-h-[18px] mt-1">
                    {errors.priority && (
                      <p className="text-xs text-red-600 font-medium">
                        {errors.priority.message}
                      </p>
                    )}
                  </div>
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
                  <div className="min-h-[18px] mt-1" />
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
                <div className="min-h-[18px] mt-1">
                  {errors.projectId && (
                    <p className="text-xs text-red-600 font-medium">
                      {errors.projectId.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="taskAssignee"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Assignee <span className="text-gray-400 font-normal">(Optional)</span>
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
                  <option value="">Select an assignee (optional)...</option>
                  {members?.map((mem) => (
                    <option key={mem.id} value={mem.id}>
                      {mem.name} ({mem.email})
                    </option>
                  ))}
                </select>
                <div className="min-h-[18px] mt-1">
                  {errors.assigneeId && (
                    <p className="text-xs text-red-600 font-medium">
                      {errors.assigneeId.message}
                    </p>
                  )}
                </div>
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
                <div className="min-h-[18px] mt-1">
                  {errors.dueDate && (
                    <p className="text-xs text-red-600 font-medium">
                      {errors.dueDate.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="tagInput" className="block text-sm font-semibold text-gray-800 mb-2">
                  Categorization Tags
                </label>
                
                {/* Input + Add Button */}
                <div className="flex items-center gap-2 mb-3">
                  <input
                    id="tagInput"
                    type="text"
                    placeholder="Add tag (e.g. backend, ui, api)..."
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none transition focus:border-purple-500 focus:ring-2 focus:ring-purple-100 text-gray-700"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const inputEl = e.currentTarget;
                        const val = inputEl.value.trim();
                        if (val) {
                          const currentTags = formValues.tags
                            ? formValues.tags.split(",").map((t) => t.trim()).filter(Boolean)
                            : [];
                          if (!currentTags.includes(val.toLowerCase())) {
                            const newTags = [...currentTags, val.toLowerCase()].join(", ");
                            setValue("tags", newTags, { shouldValidate: true, shouldDirty: true });
                          }
                          inputEl.value = "";
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const inputEl = document.getElementById("tagInput") as HTMLInputElement | null;
                      if (inputEl?.value.trim()) {
                        const val = inputEl.value.trim();
                        const currentTags = formValues.tags
                          ? formValues.tags.split(",").map((t) => t.trim()).filter(Boolean)
                          : [];
                        if (!currentTags.includes(val.toLowerCase())) {
                          const newTags = [...currentTags, val.toLowerCase()].join(", ");
                          setValue("tags", newTags, { shouldValidate: true, shouldDirty: true });
                        }
                        inputEl.value = "";
                      }
                    }}
                    className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
                  >
                    Add
                  </button>
                </div>

                {/* Quick Add Pills */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-500">Quick Add:</span>
                  {["ui", "backend", "docs"].map((quickTag) => {
                    const currentTagsList = formValues.tags
                      ? formValues.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean)
                      : [];
                    const isAdded = currentTagsList.includes(quickTag);
                    return (
                      <button
                        key={quickTag}
                        type="button"
                        onClick={() => {
                          if (!isAdded) {
                            const updated = [...currentTagsList, quickTag].join(", ");
                            setValue("tags", updated, { shouldValidate: true, shouldDirty: true });
                          }
                        }}
                        className={`rounded-lg border border-dashed px-2.5 py-1 text-xs font-medium transition ${
                          isAdded
                            ? "border-purple-300 bg-purple-50 text-purple-600 opacity-60 cursor-default"
                            : "border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:border-slate-400"
                        }`}
                      >
                        + {quickTag}
                      </button>
                    );
                  })}
                </div>

                {/* Active Tag Badges */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {(formValues.tags
                    ? formValues.tags.split(",").map((t) => t.trim()).filter(Boolean)
                    : []
                  ).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50/80 px-3 py-1 text-xs font-semibold text-purple-700"
                    >
                      <svg
                        className="w-3.5 h-3.5 text-purple-600 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M17.707 9.293a1 1 0 000-1.414l-7-7A1 1 0 0010 1H4a3 3 0 00-3 3v6a1 1 0 00.293.707l7 7a1 1 0 001.414 0l6-6zM5 5a1 1 0 100-2 1 1 0 000 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {tag}
                      <button
                        type="button"
                        onClick={() => {
                          const currentTagsList = formValues.tags
                            ? formValues.tags.split(",").map((t) => t.trim()).filter(Boolean)
                            : [];
                          const filtered = currentTagsList.filter((t) => t !== tag).join(", ");
                          setValue("tags", filtered, { shouldValidate: true, shouldDirty: true });
                        }}
                        className="text-purple-400 hover:text-purple-700 text-sm font-bold leading-none ml-0.5"
                        aria-label={`Remove tag ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
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
                    {selectedAssignee?.name || formValues.assigneeId || "Unassigned"}
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

          {/* Footer Controls */}
          <div className="flex justify-between items-center pt-4">
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
