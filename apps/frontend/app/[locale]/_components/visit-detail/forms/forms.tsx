import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@vms/ui";
import type { RiskLevel } from "@vms/contracts";
import { useTranslations } from "next-intl";
import * as React from "react";

const RISK_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

/** Reason capture for denying a request. */
export function DenyForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations("requests");
  const [reason, setReason] = React.useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSubmit(reason.trim());
      }}
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("denyReasonPlaceholder")}
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          intent="danger"
          size="sm"
          disabled={pending || !reason.trim()}
        >
          {t("actions.confirmDeny")}
        </Button>
        <Button
          type="button"
          intent="neutral"
          tone="ghost"
          size="sm"
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Security Manager/admin request-more-info: a reason the host must respond to via notes. */
export function RequestInfoForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (reason: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations("requests");
  const [reason, setReason] = React.useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSubmit(reason.trim());
      }}
    >
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("requestInfoPlaceholder")}
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending || !reason.trim()}>
          {t("actions.confirmRequestInfo")}
        </Button>
        <Button
          type="button"
          intent="neutral"
          tone="ghost"
          size="sm"
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}

/** Security Manager/admin flag: pick a risk level + reason; raises a security-review alert. */
export function FlagForm({
  onSubmit,
  onCancel,
  pending,
}: {
  onSubmit: (input: { level: RiskLevel; reason: string }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations("requests");
  const [reason, setReason] = React.useState("");
  const [level, setLevel] = React.useState<RiskLevel>("HIGH");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onSubmit({ level, reason: reason.trim() });
      }}
    >
      <Select value={level} onValueChange={(v) => setLevel(v as RiskLevel)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RISK_LEVELS.map((l) => (
            <SelectItem key={l} value={l}>
              {t(`riskLevel.${l}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("flagReasonPlaceholder")}
        rows={3}
      />
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          intent="danger"
          size="sm"
          disabled={pending || !reason.trim()}
        >
          {t("actions.confirmFlag")}
        </Button>
        <Button
          type="button"
          intent="neutral"
          tone="ghost"
          size="sm"
          onClick={onCancel}
        >
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
