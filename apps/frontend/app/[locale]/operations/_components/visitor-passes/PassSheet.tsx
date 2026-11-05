"use client";

import {
  Alert,
  AlertDescription,
  Button,
  DetailDrawer,
  Label,
  Spinner,
  Textarea,
} from "@vms/ui";
import { Eye } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";
import { Field } from "@/app/[locale]/_components/visit-detail/helpers";
import { SheetSection } from "@/app/[locale]/_components/visit-detail/sections/SheetSection";
import {
  useMarkPassesPrinted,
  useReactivatePass,
  useRetirePass,
  useVisitorPass,
} from "@/data/visitor-passes/queries";
import type { PassDetail } from "@/data/visitor-passes/visitor-passes.api";
import { formatWatDateTime } from "@/shared/wat";
import { FlipPreviewDialog } from "../FlipPreviewDialog";
import { PassBack, PassFront } from "./PassFaces";
import { PassPrintView } from "./PassPrintView";
import { PassStatusBadge } from "./PassStatusBadge";

/** Take a pass out of service (or back in); refused while it's handed out. */
function RetireSection({ pass }: { pass: PassDetail }) {
  const t = useTranslations("operations.visitorPasses.sheet");
  const locale = useLocale();
  const retire = useRetirePass();
  const reactivate = useReactivatePass();
  const [note, setNote] = React.useState("");
  const failed = retire.isError || reactivate.isError;

  return (
    <div className="flex flex-col gap-3">
      {failed ? (
        <Alert intent="danger">
          <AlertDescription>{t("actionError")}</AlertDescription>
        </Alert>
      ) : null}
      {pass.status === "RETIRED" ? (
        <>
          <span className="text-sm text-fg-muted">
            {pass.retiredAt
              ? t("retired", {
                  when: formatWatDateTime(pass.retiredAt, locale),
                })
              : null}
            {pass.retireNote ? ` — ${pass.retireNote}` : ""}
          </span>
          <Button
            intent="neutral"
            tone="outline"
            className="self-start"
            disabled={reactivate.isPending}
            onClick={() => reactivate.mutate(pass.id)}
          >
            {t("reactivate")}
          </Button>
        </>
      ) : pass.status === "IN_USE" ? (
        <span className="text-sm text-fg-muted">{t("inUseHint")}</span>
      ) : (
        <>
          <span className="text-sm text-fg-muted">{t("retireHelp")}</span>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="retire-note">{t("retireNote")}</Label>
            <Textarea
              id="retire-note"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button
            intent="danger"
            tone="outline"
            className="self-start"
            disabled={retire.isPending}
            onClick={() =>
              retire.mutate(
                { id: pass.id, note: note.trim() || undefined },
                { onSuccess: () => setNote("") },
              )
            }
          >
            {t("retire")}
          </Button>
        </>
      )}
    </div>
  );
}

/** One pass: who holds it, its full print history, preview/reprint and retire. */
export function PassSheet({
  id,
  onClose,
}: {
  id: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("operations.visitorPasses.sheet");
  const tPass = useTranslations("operations.visitorPasses");
  const locale = useLocale();
  const { data: pass, isLoading, isError } = useVisitorPass(id);
  const markPrinted = useMarkPassesPrinted();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [printing, setPrinting] = React.useState(false);
  const date = (d: string | null) => (d ? formatWatDateTime(d, locale) : "—");

  return (
    <DetailDrawer
      open={!!id}
      side="start"
      onOpenChange={(open) => {
        if (open) return;
        setPreviewOpen(false);
        onClose();
      }}
      title={t("title")}
      footer={
        pass ? (
          <div className="flex w-full justify-end">
            <Button onClick={() => setPreviewOpen(true)}>
              <Eye className="size-4" aria-hidden="true" />
              {t("previewPass")}
            </Button>
          </div>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : isError || !pass ? (
        <Alert intent="danger">
          <AlertDescription>{t("loadError")}</AlertDescription>
        </Alert>
      ) : (
        <>
          <SheetSection title={t("preview")}>
            <div className="flex items-start gap-4">
              {/* Thumbnail of the true-size front; the modal shows it large. */}
              <div className="relative h-[calc(325px*0.6)] w-[calc(204px*0.6)] shrink-0">
                <div className="absolute left-0 top-0 origin-top-left scale-[0.6]">
                  <PassFront pass={pass} />
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-sm text-fg">{pass.zone}</span>
                <span className="font-mono text-lg font-semibold text-fg">
                  {pass.cardNumber}
                </span>
                <PassStatusBadge status={pass.status} />
                {pass.holder ? (
                  <span className="text-sm text-fg-muted">
                    {t("holder")}: {pass.holder.visitorName}
                    {pass.holder.assignedAt
                      ? ` · ${t("since", { when: date(pass.holder.assignedAt) })}`
                      : ""}
                  </span>
                ) : null}
              </div>
            </div>
          </SheetSection>

          <SheetSection title={t("details")}>
            <div className="grid grid-cols-2 gap-4">
              <Field label={tPass("columns.origin")}>
                {tPass(`origin.${pass.origin}`)}
              </Field>
              <Field label={tPass("columns.prints")}>
                {new Intl.NumberFormat(locale).format(pass.printCount)}
              </Field>
              <Field label={t("created")}>{date(pass.createdAt)}</Field>
              <Field label={t("lastReturned")}>{date(pass.returnedAt)}</Field>
            </div>
          </SheetSection>

          <SheetSection title={t("history")}>
            {pass.prints.length === 0 ? (
              <span className="text-sm text-fg-muted">{t("noHistory")}</span>
            ) : (
              <ol className="flex flex-col divide-y divide-border">
                {pass.prints.map((p) => (
                  <li key={p.id} className="flex flex-col gap-0.5 py-2">
                    <span className="text-sm font-medium text-fg">
                      {t(`kind.${p.kind}`)}
                    </span>
                    <span className="text-xs text-fg-muted">
                      {[
                        date(p.createdAt),
                        p.actorName ? t("by", { name: p.actorName }) : null,
                        p.batchId
                          ? t("batch", { id: p.batchId.slice(0, 8) })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {p.note ? (
                      <span className="text-xs text-fg-muted">{p.note}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </SheetSection>

          <SheetSection title={t("retire")}>
            <RetireSection pass={pass} />
          </SheetSection>

          <FlipPreviewDialog
            open={previewOpen}
            onOpenChange={setPreviewOpen}
            title={t("previewTitle")}
            front={<PassFront pass={pass} />}
            back={<PassBack />}
            faceWidth="204px"
            faceHeight="325px"
            printLabel={t("print")}
            onPrint={
              pass.status === "RETIRED" ? undefined : () => setPrinting(true)
            }
            printing={printing}
            printView={
              <PassPrintView
                passes={[pass]}
                onDone={() => {
                  setPrinting(false);
                  markPrinted.mutate({ ids: [pass.id] });
                }}
              />
            }
          />
        </>
      )}
    </DetailDrawer>
  );
}
