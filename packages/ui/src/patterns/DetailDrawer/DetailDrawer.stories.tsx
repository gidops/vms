import type { Meta, StoryObj } from "@storybook/react-vite";
import { Mail, Phone } from "lucide-react";
import { Avatar } from "../../primitives/Avatar/Avatar";
import { Button } from "../../primitives/Button/Button";
import { Card } from "../../components/Card/Card";
import { StatusBadge } from "../../components/StatusBadge/StatusBadge";
import {
  Timeline,
  type TimelineStep,
} from "../../components/Timeline/Timeline";
import { DetailDrawer, DetailSection } from "./DetailDrawer";

const meta = {
  title: "Patterns/DetailDrawer",
  component: DetailDrawer,
  args: { title: "Visit Request Details", children: null },
} satisfies Meta<typeof DetailDrawer>;

export default meta;
type Story = StoryObj<typeof meta>;

const STEPS: TimelineStep[] = [
  {
    key: "invite",
    label: "Invite Created",
    description: "2 Mar, 9:42 AM",
    state: "complete",
  },
  { key: "approval", label: "Awaiting CSO Approval", state: "complete" },
  { key: "checkin", label: "Checked In", state: "current" },
  { key: "pass", label: "Pass Issued", state: "upcoming" },
  { key: "checkout", label: "Checked Out", state: "upcoming" },
];

export const VisitRequest: Story = {
  render: (args) => (
    <DetailDrawer
      {...args}
      description="Request #VR-1042"
      trigger={<Button>Open details</Button>}
      footer={
        <>
          <Button intent="danger" tone="soft">
            Cancel Request
          </Button>
          <Button intent="neutral" tone="outline">
            Add Note
          </Button>
          <Button intent="success">Check-In</Button>
        </>
      }
    >
      <DetailSection title="Host / Unit (Floor Details)">
        <Card className="flex items-center gap-3 p-4">
          <Avatar name="Daniel Ade" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-fg">Daniel Ade</span>
            <span className="text-xs text-fg-muted">Finance · 12th floor</span>
          </div>
        </Card>
      </DetailSection>

      <DetailSection title="Visitor Information">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <Avatar name="Judith Francis" />
              <div className="flex flex-col">
                <span className="text-sm font-medium text-fg">
                  Judith Francis
                </span>
                <span className="text-xs text-fg-muted">Acme Corp.</span>
              </div>
            </div>
            <StatusBadge status="CHECKED_IN" />
          </div>
          <div className="flex flex-col gap-1 text-sm text-fg-muted">
            <span className="flex items-center gap-2">
              <Mail className="size-4" aria-hidden="true" /> judith@acme.com
            </span>
            <span className="flex items-center gap-2">
              <Phone className="size-4" aria-hidden="true" /> +234 800 000 0000
            </span>
          </div>
        </Card>
      </DetailSection>

      <DetailSection title="Track request status">
        <Timeline steps={STEPS} />
      </DetailSection>

      <DetailSection title="Purpose of visit">
        <p className="text-sm text-fg-muted">
          Quarterly account review with the finance team.
        </p>
      </DetailSection>
    </DetailDrawer>
  ),
};
