"use client";

import type { RfidCardStatus } from "@vms/contracts";
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Pagination,
  RecordTable,
  SearchInput,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@vms/ui";
import { IdCard, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { FilterPills } from "@/app/[locale]/_components/FilterPills";
import {
  useRfidAssignments,
  useRfidCards,
  useSetRfidCardStatus,
} from "@/data/rfid-cards/queries";
import { useDebounced } from "@/shared/useDebounced";
import { formatWatDateTime } from "@/shared/wat";
import { AssignCardDrawer } from "./AssignCardDrawer";
import { AssignmentBadge } from "./AssignmentBadge";
import { AssignmentSheet } from "./AssignmentSheet";

const PAGE_SIZE = 20;
type View = "active" | "history" | "registry";

const CARD_STATUS_INTENT: Record<
  RfidCardStatus,
  "success" | "info" | "danger" | "neutral"
> = {
  AVAILABLE: "success",
  ASSIGNED: "info",
  LOST: "danger",
  RETIRED: "neutral",
};

function Toolbar({
  count,
  label,
  search,
  onSearch,
  placeholder,
}: {
  count: number | undefined;
  label: string;
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
}) {
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-xl font-semibold text-primary" aria-live="polite">
        {count === undefined
          ? "—"
          : new Intl.NumberFormat(locale).format(count)}{" "}
        <span className="font-normal text-fg-muted">{label}</span>
      </h3>
      <SearchInput
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        onClear={() => onSearch("")}
        placeholder={placeholder}
        aria-label={placeholder}
        className="sm:w-80"
      />
    </div>
  );
}

/** Cards out now (soonest to end first), or past issues (latest first). */
function Assignments({
  view,
  onOpen,
}: {
  view: "active" | "history";
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("operations.accessCards");
  const locale = useLocale();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search.trim());
  const list = useRfidAssignments({
    view,
    search: debounced || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const data = list.data;

  return (
    <RecordTable
      frameless
      toolbar={
        <Toolbar
          count={data?.total}
          label={view === "active" ? t("countActive") : t("countHistory")}
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t("searchPlaceholder")}
        />
      }
      isEmpty={!!data && data.items.length === 0}
      emptyState={
        <EmptyState
          icon={IdCard}
          title={
            debounced
              ? t("noMatches")
              : view === "active"
                ? t("emptyActive")
                : t("emptyHistory")
          }
        />
      }
      pagination={
        data && data.totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        ) : undefined
      }
    >
      {list.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.visitor")}</TableHead>
              <TableHead>{t("columns.card")}</TableHead>
              <TableHead>{t("columns.validUntil")}</TableHead>
              <TableHead>
                {view === "active" ? t("columns.status") : t("columns.closed")}
              </TableHead>
              <TableHead>
                <span className="sr-only">{t("columns.action")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody striped>
            {(data?.items ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <Avatar
                      name={a.visitor.fullName}
                      size="md"
                      accent="single"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">
                        {a.visitor.fullName}
                      </span>
                      <span className="truncate text-xs text-fg-muted">
                        {a.visitor.organization ?? a.visitor.email}
                      </span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="font-mono text-fg">
                  {a.card.cardNumber}
                </TableCell>
                <TableCell className="whitespace-nowrap text-fg-muted">
                  {formatWatDateTime(a.validUntil, locale)}
                </TableCell>
                <TableCell>
                  <span className="flex flex-col gap-1">
                    <AssignmentBadge item={a} />
                    {a.returnedAt ? (
                      <span className="text-xs text-fg-muted">
                        {formatWatDateTime(a.returnedAt, locale)}
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell>
                  <Button
                    intent="neutral"
                    tone="outline"
                    size="sm"
                    className="min-w-28 text-xs"
                    onClick={() => onOpen(a.id)}
                  >
                    {t("view")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </RecordTable>
  );
}

/** Every card ever logged: status, current holder, times issued. */
function Registry({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useTranslations("operations.accessCards");
  const tStatus = useTranslations("operations.accessCards.cardStatus");
  const locale = useLocale();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const debounced = useDebounced(search.trim());
  const list = useRfidCards({
    search: debounced || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const setStatus = useSetRfidCardStatus();
  const data = list.data;

  return (
    <RecordTable
      frameless
      toolbar={
        <Toolbar
          count={data?.total}
          label={t("countCards")}
          search={search}
          onSearch={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={t("registrySearch")}
        />
      }
      isEmpty={!!data && data.items.length === 0}
      emptyState={
        <EmptyState
          icon={IdCard}
          title={debounced ? t("noMatches") : t("emptyRegistry")}
        />
      }
      pagination={
        data && data.totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        ) : undefined
      }
    >
      {list.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.card")}</TableHead>
              <TableHead>{t("columns.cardStatus")}</TableHead>
              <TableHead>{t("columns.holder")}</TableHead>
              <TableHead>{t("columns.timesIssued")}</TableHead>
              <TableHead>
                <span className="sr-only">{t("columns.action")}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody striped>
            {(data?.items ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-fg">
                  {c.cardNumber}
                </TableCell>
                <TableCell>
                  <Badge intent={CARD_STATUS_INTENT[c.status]}>
                    {tStatus(c.status)}
                  </Badge>
                </TableCell>
                <TableCell className="text-fg-muted">
                  {c.current ? (
                    <span className="flex flex-col">
                      <span className="text-fg">{c.current.visitorName}</span>
                      <span className="text-xs">
                        {t("until", {
                          when: formatWatDateTime(c.current.validUntil, locale),
                        })}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-fg-muted">{c.timesIssued}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-2">
                    {c.current ? (
                      <Button
                        intent="neutral"
                        tone="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => onOpen(c.current!.assignmentId)}
                      >
                        {t("view")}
                      </Button>
                    ) : null}
                    {c.status === "LOST" || c.status === "RETIRED" ? (
                      <Button
                        intent="neutral"
                        tone="outline"
                        size="sm"
                        className="text-xs"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({ id: c.id, status: "AVAILABLE" })
                        }
                      >
                        {c.status === "LOST" ? t("markFound") : t("reinstate")}
                      </Button>
                    ) : null}
                    {c.status === "AVAILABLE" ? (
                      <Button
                        intent="neutral"
                        tone="ghost"
                        size="sm"
                        className="text-xs"
                        disabled={setStatus.isPending}
                        onClick={() =>
                          setStatus.mutate({ id: c.id, status: "RETIRED" })
                        }
                      >
                        {t("retire")}
                      </Button>
                    ) : null}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </RecordTable>
  );
}

/** Reception retrieves personalised RFID cards at check-out. */
export function AccessCardsTab() {
  const t = useTranslations("operations.accessCards");
  const [view, setView] = React.useState<View>("active");
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterPills<View>
          aria-label={t("title")}
          value={view}
          onValueChange={setView}
          options={[
            { value: "active", label: t("views.active") },
            { value: "history", label: t("views.history") },
            { value: "registry", label: t("views.registry") },
          ]}
        />
        <Button onClick={() => setAssignOpen(true)}>
          <Plus className="size-4" aria-hidden="true" />
          {t("assignCard")}
        </Button>
      </div>

      {view === "registry" ? (
        <Registry onOpen={setOpenId} />
      ) : (
        <Assignments key={view} view={view} onOpen={setOpenId} />
      )}

      <AssignCardDrawer
        open={assignOpen}
        onOpenChange={setAssignOpen}
        onAssigned={(created) => {
          setAssignOpen(false);
          setView("active");
          // Open the new card: its preview and the Print button.
          setOpenId(created.id);
        }}
      />
      <AssignmentSheet id={openId} onClose={() => setOpenId(null)} />
    </section>
  );
}
