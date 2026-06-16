import * as React from "react";

/** Two-column settings row: title + helper on the left, content on the right. */
export function SettingsRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-4 py-8 lg:grid-cols-[minmax(0,280px)_1fr] lg:gap-12">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-fg">{title}</h2>
        {description ? (
          <p className="text-sm text-fg-muted">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function SettingsDivider() {
  return <hr className="border-border" />;
}
