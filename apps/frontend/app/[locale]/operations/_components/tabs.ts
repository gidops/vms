import { PERMISSIONS } from "@vms/contracts";

/**
 * Operations tabs in display order, each shown with its permission. None of
 * these permissions is given to a scoped role, so only the System Admin sees
 * the page (and its account-menu link).
 */
export const OPERATIONS_TABS = [
  { value: "accessCards", permission: PERMISSIONS.RFID_MANAGE },
  { value: "deskQr", permission: PERMISSIONS.ISSUER_READ },
  { value: "audit", permission: PERMISSIONS.AUDIT_READ },
] as const;

export type OperationsTab = (typeof OPERATIONS_TABS)[number]["value"];
