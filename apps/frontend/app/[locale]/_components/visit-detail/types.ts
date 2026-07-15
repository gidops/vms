import type { StaffActivityCategory } from "@/data/staff/staff.api";

/** An item selected from a feed/table to open in the detail sheet. */
export interface SelectedItem {
  kind: "request" | "alert";
  id: string;
}

/**
 * Context passed when the sheet is opened from an activity feed item — renders a
 * coloured banner describing the update above the sections.
 */
export interface NotificationContext {
  category: StaffActivityCategory;
  title: string;
  body: string;
  createdAt: string;
}
