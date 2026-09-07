import { z } from "zod";

export const step1Schema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(50, "Title must not exceed 50 characters"),
  description: z.string().min(1, "Description is required"),
  priority: z.enum(["low", "medium", "high"], {
    error: "Priority is required",
  }),
  status: z.string().optional(),
});

export const step2Schema = z.object({
  assigneeId: z.string().optional(),
  projectId: z.string().min(1, "Project is required"),
});

export const step3Schema = z.object({
  dueDate: z.string().min(1, "Due date is required"),
  tags: z.string().optional(),
});

export const createTaskSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema);

export type MultiStepTaskFormValues = z.infer<typeof createTaskSchema>;
