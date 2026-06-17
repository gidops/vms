import { z } from "zod";

/** An internal employee who can receive visitors. */
export const Host = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  department: z.string().nullable().optional(),
  office: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Host = z.infer<typeof Host>;

/** A host joined with the user behind it (name/email) — used in request details. */
export const HostWithUser = Host.extend({
  user: z.object({
    id: z.string().uuid(),
    fullName: z.string().min(1),
    email: z.string().email(),
  }),
});
export type HostWithUser = z.infer<typeof HostWithUser>;
