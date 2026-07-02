// Phone normalization is defined once in @vms/contracts (shared with the
// frontend). Re-exported here as the send-time safety net so a dirty stored
// value still dials as valid E.164 — Twilio otherwise rejects with error 21211.
export { normalizeE164 } from '@vms/contracts';
