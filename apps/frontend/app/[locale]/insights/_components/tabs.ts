import { PERMISSIONS } from "@vms/contracts";

/** Each tab shows with any one of its permissions; `insights:self` scopes it to the caller's own visits. */
export const INSIGHTS_TABS = [
  { value: "overview", anyOf: [PERMISSIONS.OVERVIEW_READ] },
  { value: "evacuation", anyOf: [PERMISSIONS.EVACUATION_READ] },
  {
    value: "history",
    anyOf: [PERMISSIONS.HISTORY_READ, PERMISSIONS.INSIGHTS_SELF],
  },
  {
    value: "visitors",
    anyOf: [PERMISSIONS.VISITOR_READ, PERMISSIONS.INSIGHTS_SELF],
  },
  {
    value: "analytics",
    anyOf: [PERMISSIONS.REPORT_READ, PERMISSIONS.INSIGHTS_SELF],
  },
] as const;

export type InsightsTab = (typeof INSIGHTS_TABS)[number]["value"];
