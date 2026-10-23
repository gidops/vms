import { Textarea } from "@vms/ui";
import { Loader2, Send } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import * as React from "react";
import { useAddNote } from "@/data/requests/queries";
import type { VisitNote } from "@/data/visits/visits.api";

/** The rendered list of notes/remarks on a visit or alert. */
export function NoteList({
  notes,
  emptyLabel,
}: {
  notes: VisitNote[];
  emptyLabel: string;
}) {
  const format = useFormatter();
  if (notes.length === 0)
    return <p className="text-sm text-fg-subtle">{emptyLabel}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border border-border p-3">
          <p className="text-sm text-fg">{note.body}</p>
          <p className="mt-1 text-xs text-fg-subtle">
            {note.authorName} ·{" "}
            {format.dateTime(new Date(note.createdAt), {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Inline note composer with a send-icon button — the sole communication channel
 * for visits and alerts. Shows an "Adding note" indicator while in flight.
 */
export function NoteComposer({
  target,
  placeholder,
}: {
  target: { visitId?: string; alertId?: string };
  placeholder?: string;
}) {
  const t = useTranslations("requests");
  const [body, setBody] = React.useState("");
  const addNote = useAddNote(target);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || addNote.isPending) return;
    addNote.mutate(body.trim(), { onSuccess: () => setBody("") });
  };

  return (
    <form className="flex flex-col gap-1.5" onSubmit={submit}>
      <div className="relative">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder ?? t("addNotePlaceholder")}
          rows={3}
          className="pe-12"
        />
        <button
          type="submit"
          disabled={!body.trim() || addNote.isPending}
          aria-label={t("actions.addNote")}
          className="absolute bottom-3 end-3 text-primary transition-opacity disabled:opacity-40"
        >
          {addNote.isPending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-5 rtl:-scale-x-100" aria-hidden="true" />
          )}
        </button>
      </div>
      {addNote.isPending ? (
        <span className="flex items-center gap-1.5 text-xs text-fg-muted">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t("addingNote")}
        </span>
      ) : null}
    </form>
  );
}
