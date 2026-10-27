import { PERMISSIONS } from "@vms/contracts";
import {
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

/** Keys the backend doesn't issue yet make `hasPermission` return false, so their UI stays hidden. */
export const ADMIN_PERMISSIONS = {
  WATCHLIST_READ: "watchlist:read",
  REPORT_READ: PERMISSIONS.REPORT_READ,
  REPORT_EXPORT: PERMISSIONS.REPORT_EXPORT,
  /** Floors, locations and visit categories — System Admin only. */
  CONFIG_MANAGE: "config:manage",
  INTEGRATION_MANAGE: "integration:manage",
} as const;

export type AdminSection =
  | "overview"
  | "visitors"
  | "requests"
  | "watchlist"
  | "evacuation"
  | "optIns"
  | "deskQr"
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
    key: "integrations",
    icon: Puzzle,
    permission: ADMIN_PERMISSIONS.INTEGRATION_MANAGE,
  },
  { key: "settings", icon: Settings, href: "/settings" },
];
