// Shared, typed contracts for the VMS platform. Single source of truth for
// enums, request/response shapes, and validation — consumed by the NestJS
// backend (DTO validation) and the Next.js frontend (forms, API parsing, mocks).

export * from "./common/enums.js";
export * from "./common/pagination.js";
export * from "./user/user.schema.js";
export * from "./auth/auth.schema.js";
export * from "./auth/rbac.schema.js";
export * from "./visitor/visitor.schema.js";
export * from "./host/host.schema.js";
export * from "./visit/visit.schema.js";
export * from "./note/note.schema.js";
export * from "./alert/alert.schema.js";
export * from "./inbox/inbox.schema.js";
export * from "./notification/notification.schema.js";
export * from "./upload/upload.schema.js";
