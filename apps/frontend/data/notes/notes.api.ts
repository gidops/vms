import { api } from "@/data/http/client";
import type { VisitNote } from "@/data/visits/visits.api";

export const notesApi = {
  add(input: {
    visitId?: string;
    alertId?: string;
    body: string;
  }): Promise<VisitNote> {
    return api<VisitNote>("/notes", { method: "POST", body: input });
  },
};
