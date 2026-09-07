import { z } from "zod";

export const multiStepProjectSchema = z
  .object({
    // Step 1: Project Information
    name: z
      .string()
      .min(3, "Project name must be at least 3 characters long")
      .max(50, "Project name must not exceed 50 characters"),
    description: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim().length === 0 || val.trim().length >= 10,
        {
          message: "Description must be at least 10 characters if provided",
        },
      ),

    // Step 2: Team & Timeline
    memberIds: z.array(z.string()).optional(),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),

    // Step 3: Additional Details
    priority: z.enum(["low", "medium", "high"]),
    projectState: z.enum([
      "planning",
      "active",
      "on_hold",
      "completed",
      "archived",
    ]),
    budget: z.string().optional(),
    category: z.string().min(1, "Category selection is required"),
  })
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return new Date(data.endDate) >= new Date(data.startDate);
    },
    {
      message: "Target completion date must be after or on the start date",
      path: ["endDate"],
    },
  );

export type MultiStepProjectInput = z.infer<typeof multiStepProjectSchema>;
