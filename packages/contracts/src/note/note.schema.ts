import { z } from "zod";

/** A freeform remark attached to a visit request or an alert. */
export const Note = z.object({
  id: z.string().uuid(),
  visitId: z.string().uuid().nullable().optional(),
  alertId: z.string().uuid().nullable().optional(),
  // Null once the author's account is deleted; authorName is preserved.
  authorId: z.string().uuid().nullable(),
  authorName: z.string().min(1),
  body: z.string().min(1),
  createdAt: z.coerce.date(),
});
export type Note = z.infer<typeof Note>;

/** Add a note to a visit or an alert (exactly one target). */
export const AddNoteInput = z
  .object({
    visitId: z.string().uuid().optional(),
    alertId: z.string().uuid().optional(),
    body: z.string().min(1).max(2000),
  })
  .refine((v) => Boolean(v.visitId) !== Boolean(v.alertId), {
    message: "Provide exactly one of visitId or alertId",
  });
export type AddNoteInput = z.infer<typeof AddNoteInput>;
