import { PERMISSIONS } from "@vms/contracts";

/**
 * Tabs in display order, each shown with any one of its permissions. History,
 * Visitors and Analytics are facility-wide with the first permission, or the
 * caller's own visits with `insights:self` (staff); the server picks the scope.
 */
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
