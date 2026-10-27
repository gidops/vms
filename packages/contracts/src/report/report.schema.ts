import { z } from "zod";

export const EXPORT_MAX_RANGE_DAYS = 366;

const IsoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Invalid date");

export function inclusiveDaySpan(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000) + 1;
}

/** Filters on scheduledAt read on the Africa/Lagos calendar, inclusive. */
export const ExportVisitsQuery = z
  .object({
    from: IsoDay,
    to: IsoDay,
    format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  })
  .superRefine((v, ctx) => {
    const span = inclusiveDaySpan(v.from, v.to);
    if (span < 1)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "End date must be on or after the start date",
      });
    else if (span > EXPORT_MAX_RANGE_DAYS)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: `Range can be at most ${EXPORT_MAX_RANGE_DAYS} days`,
      });
  });
export type ExportVisitsQuery = z.infer<typeof ExportVisitsQuery>;
