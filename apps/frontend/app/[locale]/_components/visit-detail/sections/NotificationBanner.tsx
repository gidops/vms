import { Badge } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import type { NotificationContext } from "../types";

/**
 * Coloured banner shown when the sheet is opened from an activity-feed item,
 * describing the update (category, relative time, title, body).
 */
export function NotificationBanner({ ctx }: { ctx: NotificationContext }) {
  const tCat = useTranslations("staff.updates");
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-emphasis p-4 text-emphasis-fg">
      <div className="flex items-center justify-between gap-2">
        <Badge
          intent="neutral"
          tone="soft"
          className="bg-surface/15 text-emphasis-fg"
        >
          {tCat(`category.${ctx.category}`)}
        </Badge>
        <span className="text-xs text-emphasis-muted">
          {format.relativeTime(new Date(ctx.createdAt))}
        </span>
      </div>
      <p className="text-lg font-semibold text-accent">{ctx.title}</p>
      <p className="text-sm text-emphasis-muted">{ctx.body}</p>
    </div>
  );
}
