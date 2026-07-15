import { useTranslations } from "next-intl";
import type { VisitRequestDetail } from "@/data/visits/visits.api";
import { NoteComposer, NoteList } from "./notes";
import { SheetSection } from "./SheetSection";

/** The visit's notes/remarks thread — shown when no Alert Summary is present. */
export function NotesSection({ data }: { data: VisitRequestDetail }) {
  const t = useTranslations("requests");
  return (
    <SheetSection title={t("sections.visitNotes")}>
      <NoteList notes={data.notes} emptyLabel={t("noNotes")} />
      <NoteComposer target={{ visitId: data.id }} />
    </SheetSection>
  );
}
