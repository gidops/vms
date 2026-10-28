import { PERMISSIONS } from "@vms/contracts";

/** No scoped role holds these permissions, so only the System Admin sees Operations. */
export const OPERATIONS_TABS = [
  { value: "accessCards", permission: PERMISSIONS.RFID_MANAGE },
  { value: "deskQr", permission: PERMISSIONS.ISSUER_READ },
  { value: "gateKiosk", permission: PERMISSIONS.GATE_MANAGE },
  { value: "audit", permission: PERMISSIONS.AUDIT_READ },
] as const;

export type OperationsTab = (typeof OPERATIONS_TABS)[number]["value"];
