import type { StaffActivityCategory } from "@/data/staff/staff.api";

/** An item selected from a feed/table to open in the detail sheet. */
export interface SelectedItem {
  kind: "request" | "alert";
  id: string;
}

/** Renders a banner describing the feed update above the sections. */
export interface NotificationContext {
  category: StaffActivityCategory;
  title: string;
  body: string;
  createdAt: string;
}
