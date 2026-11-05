"use client";

import { Button, Input, Label } from "@vms/ui";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { usePublicHostSearch } from "@/data/desk-qr/public-registration.queries";
import type { SelfForm } from "../self-registration";

/** "Who are you visiting?": search staff by name (names and units only). */
export function HostPicker({
  token,
  formToken,
  value,
  onChange,
}: {
  token: string;
  formToken: string;
  value: SelfForm["host"];
  onChange: (host: SelfForm["host"]) => void;
}) {
  const t = useTranslations("selfRegister");
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const hosts = usePublicHostSearch(token, debounced, formToken);
  const results = debounced.length >= 3 ? hosts.data : undefined;
  let announcement = "";
  if (results)
    announcement = results.length
      ? t("host.count", { count: results.length })
      : t("host.none");

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-primary-subtle px-3 py-2.5">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-medium text-fg">{value.fullName}</span>
          {value.department ? (
            <span className="text-xs text-fg-muted">{value.department}</span>
          ) : null}
        </span>
        <Button
          size="sm"
          intent="neutral"
          tone="ghost"
          onClick={() => onChange(null)}
          aria-label={t("host.remove", { name: value.fullName })}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="sr-host" className="text-sm font-medium text-fg">
        {t("host.label")}
      </Label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-fg-muted"
          aria-hidden="true"
        />
        <Input
          id="sr-host"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("host.placeholder")}
          autoComplete="off"
          aria-describedby="sr-host-help"
          className="ps-9"
        />
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      {results ? (
        <ul
          className="overflow-hidden rounded-lg border border-border shadow-sm"
          aria-label={t("host.results")}
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-fg-muted">
              {t("host.none")}
            </li>
          ) : (
            results.map((h) => (
              <li
                key={h.userId}
                className="border-b border-border last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    onChange(h);
                    setQ("");
                  }}
                  className="flex w-full flex-col px-3 py-2.5 text-start text-sm outline-none hover:bg-primary-subtle focus-visible:bg-primary-subtle"
                >
                  <span className="font-medium text-fg">{h.fullName}</span>
                  {h.department ? (
                    <span className="text-xs text-fg-muted">
                      {h.department}
                    </span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      <span id="sr-host-help" className="text-xs text-fg-muted">
        {t("host.help")}
      </span>
    </div>
  );
}
