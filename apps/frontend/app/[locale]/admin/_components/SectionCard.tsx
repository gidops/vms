import { Card, cn } from "@vms/ui";
import * as React from "react";

/**
 * Overview panel: a card with a heading row (title, optional count/actions) and
 * a body. Keeps the admin overview's cards on one spacing rhythm.
 */
export function SectionCard({
  title,
  titleId,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: React.ReactNode;
  /** Id for the heading so the region can be labelled by it. */
  titleId: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <Card
      role="region"
      aria-labelledby={titleId}
      className={cn("flex flex-col rounded-2xl", className)}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <h2 id={titleId} className="text-lg font-semibold text-fg">
          {title}
        </h2>
        {actions}
      </div>
      <div className={cn("flex-1 p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}
