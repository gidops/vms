import { Badge } from "@vms/ui";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { NotificationContext } from "../types";

/** Shown when the sheet is opened from an activity-feed item. */
export function NotificationBanner({ ctx }: { ctx: NotificationContext }) {
  const tCat = useTranslations("staff.updates");
  const format = useFormatter();
  // Ticks each minute so relative times stay fresh.
  const now = useNow({ updateInterval: 60_000 });
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
          {format.relativeTime(new Date(ctx.createdAt), now)}
        </span>
      </div>
      <p className="text-lg font-semibold text-accent">{ctx.title}</p>
      <p className="text-sm text-emphasis-muted">{ctx.body}</p>
    </div>
  );
}
