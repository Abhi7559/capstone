import { z } from "zod";

export const inviteMemberSchema = z.object({
  name: z.string().min(1, "Name of the member is required"),
  email: z.string().min(1, "Email is required").email("Invalid email format"),
  designation: z.string().optional(),
  joiningDate: z.string().optional(),
});

export type InviteMemberFormValues = z.infer<typeof inviteMemberSchema>;
