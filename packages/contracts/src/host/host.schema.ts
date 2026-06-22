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

/**
 * A selectable host in the invite/walk-in forms — a user with the STAFF role.
 * `userId` is the User id (a Host row is ensured server-side on submit).
 */
export const HostOption = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  department: z.string().nullable().optional(),
  office: z.string().nullable().optional(),
});
export type HostOption = z.infer<typeof HostOption>;
