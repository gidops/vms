import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageSquare } from "lucide-react";
import { Badge } from "../../primitives/Badge/Badge";
import { InboxCard } from "./InboxCard";

const meta = {
  title: "Components/InboxCard",
  component: InboxCard,
  parameters: { layout: "padded" },
} satisfies Meta<typeof InboxCard>;

export default meta;
type Story = StoryObj<typeof meta>;

function Meta_({
  createdBy,
  status,
  statusIntent,
  notes,
}: {
  createdBy: string;
  status: string;
  statusIntent: "warning" | "success" | "danger" | "neutral";
  notes?: number;
}) {
  return (
    <>
      <Badge intent="neutral" tone="soft">
        Created by{" "}
        <span className="font-semibold text-primary">{createdBy}</span>
      </Badge>
      <Badge intent={statusIntent} tone="soft">
        {status}
      </Badge>
      {notes !== undefined ? (
        <Badge intent="neutral" tone="soft">
          <MessageSquare className="size-3.5" aria-hidden="true" />
          {notes} notes
        </Badge>
      ) : null}
    </>
  );
}

export const Request: Story = {
  args: {
    type: "request",
    typeLabel: "Visit Request",
    title: "Visit Request from Dr Alabi",
    description: (
      <>
        Visit request for Mr Jude from{" "}
        <span className="font-semibold text-primary">
          Standard Chartered Bank
        </span>
        .
      </>
    ),
    timeAgo: "2 min ago",
    meta: (
      <Meta_
        createdBy="Judith Francis"
        status="Awaiting CSO Approval"
        statusIntent="warning"
        notes={2}
      />
    ),
  },
};

export const Alert: Story = {
  args: {
    type: "alert",
    typeLabel: "Alerts",
    title: "Flagged Visitor Match",
    description:
      "This visitor matches a flagged profile and requires CSO review.",
    timeAgo: "2 min ago",
    meta: (
      <Meta_
        createdBy="Judith Francis"
        status="Denied by CSO"
        statusIntent="danger"
      />
    ),
  },
};
