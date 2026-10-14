"use client";

import { Badge, Skeleton } from "@vms/ui";
import { useFormatter, useTranslations } from "next-intl";
import { useUpcomingVisits } from "@/data/admin/queries";

/** Initials for the neutral avatar chip ("Ravi Kumar" → "RK"). */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Approved/pending visitors still to arrive today, soonest first. */
export function UpcomingCard({
  onView,
}: {
  onView: (visitId: string) => void;
}) {
  const t = useTranslations("admin.overview.upcoming");
  const format = useFormatter();
  const upcoming = useUpcomingVisits();
  const items = upcoming.data?.items ?? [];

  return (
    <section
      aria-labelledby="admin-upcoming"
      className="flex flex-col rounded-2xl border border-border bg-surface shadow-xs"
    >
      <h2
        id="admin-upcoming"
        className="px-5 pt-5 text-lg font-semibold text-fg"
      >
        {t("title")}
      </h2>
      <div className="p-5">
        {upcoming.isLoading ? (
          <div className="flex flex-col gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-fg-muted">{t("empty")}</p>
        ) : (
          <ul className="-mx-2 flex flex-col">
            {items.map((v) => {
              const name =
                v.isGroupVisit && v.groupName
                  ? v.groupName
                  : v.visitor.fullName;
              const host = v.host?.user.fullName ?? v.floor;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => onView(v.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-fg-muted"
                      aria-hidden="true"
                    >
                      {initials(name)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-semibold text-fg">
                        {name}
                      </span>
                      {host ? (
                        <span className="truncate text-xs text-fg-muted">
                          {t("host", { name: host })}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {v.scheduledAt ? (
                        <time
                          dateTime={v.scheduledAt}
                          className="text-sm font-semibold text-fg"
                        >
                          {format.dateTime(new Date(v.scheduledAt), {
                            timeStyle: "short",
                          })}
                        </time>
                      ) : null}
                      <Badge intent="primary" tone="soft" size="sm">
                        {v.status === "APPROVED" ? t("approved") : t("pending")}
                      </Badge>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
