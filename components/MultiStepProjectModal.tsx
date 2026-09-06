import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useMembers } from "@/hooks/useMembers";
import { useCreateProject, useUpdateProject } from "@/hooks/useProjects";
import {
  type MultiStepProjectInput,
  multiStepProjectSchema,
} from "@/schemas/project.schema";
import type { Project } from "@/types/project";

interface MultiStepProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProject?: Project | null;
  onSuccess?: (msg: string) => void;
}

const STEP_FIELDS: Record<number, (keyof MultiStepProjectInput)[]> = {
  1: ["name", "description", "category"],
  2: ["memberIds", "startDate", "endDate"],
  3: ["priority", "projectState"],
};

export function MultiStepProjectModal({
  isOpen,
  onClose,
  editingProject,
  onSuccess,
}: MultiStepProjectModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
  const { data: members } = useMembers();
  const { createProject, isLoading: isCreating } = useCreateProject();
  const { updateProject, isLoading: isUpdating } = useUpdateProject();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownContainerRef.current &&
        !dropdownContainerRef.current.contains(event.target as Node)
      ) {
        setIsMemberDropdownOpen(false);
      }
    }

    if (isMemberDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMemberDropdownOpen]);

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<MultiStepProjectInput>({
    resolver: zodResolver(multiStepProjectSchema),
    mode: "onTouched",
    defaultValues: {
      name: editingProject?.name || "",
      description: editingProject?.description || "",
      memberIds: editingProject?.memberIds || [],
      startDate: "",
      endDate: "",
      priority: "medium",
      projectState: "active",
      category: "Engineering",
      budget: "",
    },
  });

  const formValues = watch();

  // Reset form state when editing target changes
  useEffect(() => {
    if (isOpen) {
      if (editingProject) {
        reset({
          name: editingProject.name,
          description: editingProject.description,
          memberIds: editingProject.memberIds || [],
          startDate: editingProject.createdAt?.split("T")[0] || "",
          endDate: "",
          priority: "medium",
          projectState:
            editingProject.status === "archived"
              ? "on_hold"
              : editingProject.status || "active",
          category: "Engineering",
          budget: "",
        });
      } else {
        reset({
          name: "",
          description: "",
          memberIds: [],
          startDate: "",
          endDate: "",
          priority: "medium",
          projectState: "active",
          category: "Engineering",
          budget: "",
        });
      }
      setCurrentStep(1);
      setSubmitError(null);
    }
  }, [isOpen, editingProject, reset]);

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

  if (!isOpen) return null;

  const handleNext = async () => {
    const fieldsToValidate = STEP_FIELDS[currentStep];
    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleClose = () => {
    setCurrentStep(1);
    setSubmitError(null);
    reset();
    onClose();
  };

  const onFinalSubmit = async (data: MultiStepProjectInput) => {
    if (currentStep < 4) return;
    setSubmitError(null);
    try {
      if (editingProject) {
        await updateProject({
          id: editingProject.id,
          input: {
            name: data.name,
            description: data.description,
            memberIds: data.memberIds,
          },
        });
        onSuccess?.("Project updated successfully!");
      } else {
        await createProject({
          name: data.name,
          description: data.description,
          memberIds: data.memberIds,
        });
        onSuccess?.("Project created successfully!");
      }
      setCurrentStep(1);
      setSubmitError(null);
      reset();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to save project.",
      );
    }
  };

  const filteredMembers = (members || []).filter(
    (m) =>
      m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(memberSearchQuery.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-[840px] h-[640px] max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 font-sans overflow-hidden">
        {/* 1. FIXED HEADER */}
        <div className="flex items-center justify-between px-7 py-5 bg-white flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">
              {editingProject ? "Edit Project" : "Create New Project"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 font-medium">
              Set up your project details, team, timeline, and settings.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* TOP DIVIDER LINE BEFORE INDICATOR */}
        <div className="mx-7 border-t border-gray-400" />

        {/* COMPACT STEP INDICATOR */}
        <div className="px-7 py-3.5 bg-slate-50/70 flex-shrink-0">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {/* Step 1 */}
            <button
              type="button"
              onClick={() => currentStep > 1 && setCurrentStep(1)}
              disabled={currentStep <= 1}
              className={`flex items-center space-x-2 text-xs font-semibold transition ${
                currentStep === 1
                  ? "text-blue-600 font-bold"
                  : currentStep > 1
                    ? "text-blue-700 cursor-pointer"
                    : "text-gray-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  currentStep > 1
                    ? "bg-blue-600 text-white font-bold"
                    : currentStep === 1
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > 1 ? "✓" : "1"}
              </span>
              <span>Basic Info</span>
            </button>

            <div
              className={`h-[2px] flex-1 mx-3 ${currentStep > 1 ? "bg-blue-600" : "bg-gray-200"}`}
            />

            {/* Step 2 */}
            <button
              type="button"
              onClick={() => currentStep > 2 && setCurrentStep(2)}
              disabled={currentStep <= 2}
              className={`flex items-center space-x-2 text-xs font-semibold transition ${
                currentStep === 2
                  ? "text-blue-600 font-bold"
                  : currentStep > 2
                    ? "text-blue-700 cursor-pointer"
                    : "text-gray-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  currentStep > 2
                    ? "bg-blue-600 text-white font-bold"
                    : currentStep === 2
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > 2 ? "✓" : "2"}
              </span>
              <span>Team & Timeline</span>
            </button>

            <div
              className={`h-[2px] flex-1 mx-3 ${currentStep > 2 ? "bg-blue-600" : "bg-gray-200"}`}
            />

            {/* Step 3 */}
            <button
              type="button"
              onClick={() => currentStep > 3 && setCurrentStep(3)}
              disabled={currentStep <= 3}
              className={`flex items-center space-x-2 text-xs font-semibold transition ${
                currentStep === 3
                  ? "text-blue-600 font-bold"
                  : currentStep > 3
                    ? "text-blue-700 cursor-pointer"
                    : "text-gray-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  currentStep > 3
                    ? "bg-blue-600 text-white font-bold"
                    : currentStep === 3
                      ? "bg-blue-600 text-white font-bold"
                      : "bg-gray-200 text-gray-600"
                }`}
              >
                {currentStep > 3 ? "✓" : "3"}
              </span>
              <span>Settings</span>
            </button>

            <div
              className={`h-[2px] flex-1 mx-3 ${currentStep > 3 ? "bg-blue-600" : "bg-gray-200"}`}
            />

            {/* Step 4 */}
            <div
              className={`flex items-center space-x-2 text-xs font-semibold transition ${
                currentStep === 4 ? "text-blue-600 font-bold" : "text-gray-400"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                  currentStep === 4
                    ? "bg-blue-600 text-white font-bold"
                    : "bg-gray-200 text-gray-600"
                }`}
              >
                4
              </span>
              <span>Review</span>
            </div>
          </div>
        </div>

        {/* 2. FORM CONTENT AREA */}
        <div className="flex-1 px-7 py-5 overflow-y-auto">
          {submitError && (
            <div className="mb-5 rounded-xl bg-red-50 p-3.5 border border-red-200 text-xs font-semibold text-red-700">
              {submitError}
            </div>
          )}

          <form
            id="createProjectForm"
            onSubmit={(e) => {
              e.preventDefault();
              if (currentStep === 4) {
                handleSubmit(onFinalSubmit)(e);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (currentStep < 4) {
                  handleNext();
                }
              }
            }}
          >
            {/* STEP 1: BASIC INFO */}
            {currentStep === 1 && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Basic Information
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Start with the essential details for your project.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Project Name */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label
                        htmlFor="projNameInput"
                        className="block text-xs font-semibold text-gray-700"
                      >
                        Project Name <span className="text-red-500">*</span>
                      </label>
                      <span className={`text-[11px] font-semibold ${(formValues.name?.length || 0) >= 50 ? "text-red-600 font-bold" : "text-gray-400"}`}>
                        {formValues.name?.length || 0}/50
                      </span>
                    </div>
                    <input
                      id="projNameInput"
                      type="text"
                      maxLength={50}
                      placeholder="e.g. Enterprise CRM Revamp"
                      className={`w-full rounded-lg border h-11 px-3.5 text-xs text-gray-900 outline-none transition focus:ring-2 ${
                        errors.name || (formValues.name?.length || 0) >= 50
                          ? "border-red-500 focus:ring-red-200"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                      }`}
                      {...register("name")}
                    />
                    {errors.name ? (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">
                        {errors.name.message}
                      </p>
                    ) : (formValues.name?.length || 0) >= 50 ? (
                      <p className="mt-1 text-[11px] text-red-600 font-medium flex items-center gap-1">
                        <span>⚠️</span> Maximum limit of 50 characters reached
                      </p>
                    ) : null}
                  </div>

                  {/* Description */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label
                        htmlFor="projDescInput"
                        className="block text-xs font-semibold text-gray-700"
                      >
                        Description
                      </label>
                      <span className="text-[11px] text-gray-400">
                        Optional
                      </span>
                    </div>
                    <textarea
                      id="projDescInput"
                      rows={3}
                      placeholder="Describe the project's goals, scope, and expected outcomes..."
                      className={`w-full rounded-lg border p-3 text-xs text-gray-900 outline-none transition focus:ring-2 min-h-[90px] max-h-[140px] ${
                        errors.description
                          ? "border-red-500 focus:ring-red-200"
                          : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
                      }`}
                      {...register("description")}
                    />
                    {errors.description && (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  {/* Project Category */}
                  <div>
                    <label
                      htmlFor="projCategorySelect"
                      className="block text-xs font-semibold text-gray-700 mb-1"
                    >
                      Project Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="projCategorySelect"
                      className="w-full rounded-lg border border-gray-300 bg-white h-11 px-3 text-xs font-medium text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      {...register("category")}
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Product Design">Product Design</option>
                      <option value="Marketing & Brand">
                        Marketing & Brand
                      </option>
                      <option value="Operations">Operations</option>
                      <option value="Security & Compliance">
                        Security & Compliance
                      </option>
                    </select>
                    {errors.category && (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">
                        {errors.category.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: TEAM & TIMELINE */}
            {currentStep === 2 && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Team & Timeline
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Choose who will work on this project and define its
                    timeline.
                  </p>
                </div>

                {/* Team Member Searchable Selector */}
                <div className="relative" ref={dropdownContainerRef}>
                  <label
                    htmlFor="memberSelectBtn"
                    className="block text-xs font-semibold text-gray-700 mb-1"
                  >
                    Assign Team Members <span className="text-red-500">*</span>
                  </label>
                  <button
                    id="memberSelectBtn"
                    type="button"
                    onClick={() => setIsMemberDropdownOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between rounded-lg border border-gray-300 bg-white h-11 px-3.5 text-xs text-left shadow-sm transition hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <span className="truncate text-gray-700 font-medium">
                      {formValues.memberIds && formValues.memberIds.length > 0
                        ? `${formValues.memberIds.length} member${formValues.memberIds.length === 1 ? "" : "s"} selected`
                        : "🔍 Search and select team members..."}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isMemberDropdownOpen ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Selected Member Chips */}
                  {formValues.memberIds && formValues.memberIds.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {formValues.memberIds.map((mId) => {
                        const memberObj = members?.find((m) => m.id === mId);
                        return (
                          <span
                            key={mId}
                            className="inline-flex items-center space-x-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-800"
                          >
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] text-white uppercase font-bold">
                              {(memberObj?.name || mId).charAt(0)}
                            </span>
                            <span>{memberObj?.name || mId}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const updated = formValues.memberIds.filter(
                                  (id) => id !== mId,
                                );
                                setValue("memberIds", updated, {
                                  shouldValidate: true,
                                });
                              }}
                              className="text-blue-500 hover:text-blue-900 font-bold ml-1"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Dropdown Menu */}
                  {isMemberDropdownOpen && (
                    <div className="absolute z-50 mt-1.5 w-full rounded-xl bg-white p-2 shadow-2xl border border-gray-200 max-h-60 overflow-y-auto space-y-1">
                      <div className="px-2 py-1 mb-1 border-b border-gray-100">
                        <input
                          type="text"
                          placeholder="Search members..."
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500"
                        />
                      </div>
                      {filteredMembers.length > 0 ? (
                        filteredMembers.map((member) => {
                          const isSelected = formValues.memberIds?.includes(
                            member.id,
                          );
                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => {
                                const currentSelected =
                                  formValues.memberIds || [];
                                const updated = isSelected
                                  ? currentSelected.filter(
                                      (id) => id !== member.id,
                                    )
                                  : [...currentSelected, member.id];
                                setValue("memberIds", updated, {
                                  shouldValidate: true,
                                });
                              }}
                              className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs text-left transition ${
                                isSelected
                                  ? "bg-blue-50 text-blue-900 font-semibold"
                                  : "text-gray-700 hover:bg-gray-100"
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <input
                                  type="checkbox"
                                  checked={Boolean(isSelected)}
                                  onChange={() => {}}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                                />
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white uppercase">
                                  {member.name.charAt(0)}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-900">
                                    {member.name}
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    {member.email}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold text-gray-500 capitalize bg-gray-100 px-2 py-0.5 rounded">
                                {member.role}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-gray-400">
                          No matching members found
                        </div>
                      )}
                    </div>
                  )}

                  {errors.memberIds && (
                    <p className="mt-1 text-[11px] text-red-600 font-medium">
                      {errors.memberIds.message}
                    </p>
                  )}
                </div>

                {/* Timeline Date Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="startDateIn"
                      className="block text-xs font-semibold text-gray-700 mb-1"
                    >
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="startDateIn"
                      type="date"
                      className="w-full rounded-lg border border-gray-300 h-11 px-3.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      {...register("startDate")}
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">
                        {errors.startDate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="endDateIn"
                      className="block text-xs font-semibold text-gray-700 mb-1"
                    >
                      Target Completion Date{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="endDateIn"
                      type="date"
                      className="w-full rounded-lg border border-gray-300 h-11 px-3.5 text-xs outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      {...register("endDate")}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">
                        {errors.endDate.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: PROJECT SETTINGS */}
            {currentStep === 3 && (
              <div className="space-y-5 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Project Settings
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Define how this project should be prioritized and managed.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Priority */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
                    <label
                      htmlFor="prioritySel"
                      className="block text-xs font-bold text-gray-900 uppercase tracking-wider"
                    >
                      Priority Level
                    </label>
                    <select
                      id="prioritySel"
                      className="w-full rounded-lg border border-gray-300 bg-white h-10 px-3 text-xs font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      {...register("priority")}
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>

                  {/* Lifecycle Status */}
                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
                    <label
                      htmlFor="stateSel"
                      className="block text-xs font-bold text-gray-900 uppercase tracking-wider"
                    >
                      Lifecycle Status
                    </label>
                    <select
                      id="stateSel"
                      className="w-full rounded-lg border border-gray-300 bg-white h-10 px-3 text-xs font-semibold text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      {...register("projectState")}
                    >
                      <option value="planning"> Planning</option>
                      <option value="active"> Active</option>
                      <option value="on_hold"> On Hold</option>
                      <option value="completed"> Completed</option>
                    </select>
                  </div>
                </div>

                {/* Estimation Points */}
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <label
                      htmlFor="estInput"
                      className="block text-xs font-bold text-gray-900 uppercase tracking-wider"
                    >
                      Estimation Points
                    </label>
                    <span className="text-[11px] text-gray-400">Optional</span>
                  </div>
                  <input
                    id="estInput"
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    className="w-full rounded-lg border border-gray-300 h-10 px-3.5 text-xs text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    {...register("budget")}
                  />
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CREATE */}
            {currentStep === 4 && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    Review & Create
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Review your project details before creating the project.
                  </p>
                </div>

                {/* Summary Section 1 */}
                <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4 space-y-1.5 min-w-0 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Project Information
                    </h4>
                  </div>
                  <p className="text-sm font-bold text-gray-900 break-all break-words leading-snug">
                    {formValues.name}
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed break-all break-words whitespace-pre-wrap">
                    {formValues.description || "No description."}
                  </p>
                  <div className="pt-1">
                    <span className="inline-flex items-center rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                      {formValues.category || "Engineering"}
                    </span>
                  </div>
                </div>

                {/* Summary Section 2 */}
                <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Team & Timeline
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {formValues.memberIds && formValues.memberIds.length > 0 ? (
                      formValues.memberIds.map((mId) => {
                        const mObj = members?.find((m) => m.id === mId);
                        return (
                          <span
                            key={mId}
                            className="inline-flex items-center space-x-1 bg-white border border-gray-200 px-2 py-0.5 rounded text-[11px] font-semibold text-gray-800"
                          >
                            <span>👤 {mObj?.name || mId}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-gray-500">
                        No members selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-medium text-gray-700 pt-1">
                    📅 {formValues.startDate} → {formValues.endDate}
                  </p>
                </div>

                {/* Summary Section 3 */}
                <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Project Settings
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-800 pt-1">
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">
                        Priority
                      </span>
                      <span className="capitalize font-bold">
                        {formValues.priority}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">
                        Status
                      </span>
                      <span className="capitalize font-bold">
                        {formValues.projectState}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 block uppercase">
                        Estimation
                      </span>
                      <span className="font-bold">
                        {formValues.budget ? `${formValues.budget} pts` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* BOTTOM DIVIDER LINE BEFORE FOOTER */}
        <div className="mx-7 border-t border-gray-400" />

        {/* 3. STICKY FOOTER */}
        <div className="flex items-center justify-between px-7 py-4 bg-white flex-shrink-0">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center space-x-3">
            {currentStep < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                Continue →
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentStep === 4) {
                    handleSubmit(onFinalSubmit)();
                  }
                }}
                disabled={isCreating || isUpdating}
                className="rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm"
              >
                {isCreating
                  ? "Creating Project..."
                  : isUpdating
                    ? "Updating Project..."
                    : editingProject
                      ? "Update Project"
                      : "Create Project"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
