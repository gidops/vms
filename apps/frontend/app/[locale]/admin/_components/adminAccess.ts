import { PERMISSIONS } from "@vms/contracts";
import {
  ChartColumn,
  ClipboardCheck,
  LayoutGrid,
  MapPin,
  Puzzle,
  Settings,
  ShieldAlert,
  Tags,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Admin-console permission keys that the backend does not issue yet. The admin
 * roles (System Admin, VMC Admin, Security Manager, Read Admin, Auditor, Data
 * Officer) are being added in a separate backend change; until those keys are
 * seeded, `hasPermission` returns false for them and the gated UI stays hidden.
 * Keep this list in sync with `PERMISSIONS` in @vms/contracts once they land.
 */
export const ADMIN_PERMISSIONS = {
  WATCHLIST_READ: "watchlist:read",
  REPORT_READ: "report:read",
  REPORT_EXPORT: "report:export",
  /** Floors, locations and visit categories — System Admin only. */
  CONFIG_MANAGE: "config:manage",
  INTEGRATION_MANAGE: "integration:manage",
} as const;

export type AdminSection =
  | "overview"
  | "visitors"
  | "requests"
  | "watchlist"
  | "users"
  | "floors"
  | "categories"
  | "analytics"
  | "integrations"
  | "settings";

export interface AdminSectionDef {
  key: AdminSection;
  icon: LucideIcon;
  /** Route; omitted for sections that aren't built yet (rendered disabled). */
  href?: string;
  /** Required permission; omitted means every admin role sees it. */
  permission?: string;
}

/** Sidebar order and gating, matching the Figma admin console. */
export const ADMIN_SECTIONS: AdminSectionDef[] = [
  { key: "overview", icon: LayoutGrid, href: "/admin" },
  { key: "visitors", icon: Users },
  { key: "requests", icon: ClipboardCheck, href: "/admin/requests" },
  {
    key: "watchlist",
    icon: ShieldAlert,
    permission: ADMIN_PERMISSIONS.WATCHLIST_READ,
  },
  {
    key: "users",
    icon: UserCog,
    href: "/admin/users",
    permission: PERMISSIONS.USER_READ,
  },
  { key: "floors", icon: MapPin, permission: ADMIN_PERMISSIONS.CONFIG_MANAGE },
  {
    key: "categories",
    icon: Tags,
    permission: ADMIN_PERMISSIONS.CONFIG_MANAGE,
  },
  {
    key: "analytics",
    icon: ChartColumn,
    permission: ADMIN_PERMISSIONS.REPORT_READ,
  },
  {
    key: "integrations",
    icon: Puzzle,
    permission: ADMIN_PERMISSIONS.INTEGRATION_MANAGE,
  },
  { key: "settings", icon: Settings, href: "/settings" },
];
