import { z } from "zod";

export const Host = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  department: z.string().nullable().optional(),
  office: z.string().nullable().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type Host = z.infer<typeof Host>;

export const HostWithUser = Host.extend({
  user: z.object({
    id: z.string().uuid(),
    fullName: z.string().min(1),
    email: z.string().email(),
  }),
});
export type HostWithUser = z.infer<typeof HostWithUser>;

/** `userId` is a User id; the Host row is created server-side on submit. */
export const HostOption = z.object({
  userId: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  department: z.string().nullable().optional(),
  office: z.string().nullable().optional(),
});
export type HostOption = z.infer<typeof HostOption>;
