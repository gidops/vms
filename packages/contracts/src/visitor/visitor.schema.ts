import { z } from "zod";

/** A person who visits the premises. PII fields are encrypted at rest server-side. */
export const Visitor = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(3).nullable().optional(),
  organization: z.string().nullable().optional(),
  photoUrl: z.string().url().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Visitor = z.infer<typeof Visitor>;

export const RegisterVisitorInput = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(3).optional(),
  organization: z.string().optional(),
});
export type RegisterVisitorInput = z.infer<typeof RegisterVisitorInput>;

export const UpdateVisitorInput = RegisterVisitorInput.partial();
export type UpdateVisitorInput = z.infer<typeof UpdateVisitorInput>;
