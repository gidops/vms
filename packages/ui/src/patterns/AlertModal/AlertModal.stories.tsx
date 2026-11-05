import type { Meta, StoryObj } from "@storybook/react-vite";
import { Avatar } from "../../primitives/Avatar/Avatar";
import { Badge } from "../../primitives/Badge/Badge";
import { Button } from "../../primitives/Button/Button";
import { DialogClose } from "../../primitives/Dialog/Dialog";
import { AlertDescription, AlertTitle } from "../../components/Alert/Alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/Table/Table";
import { AlertModal } from "./AlertModal";

const meta = {
  title: "Patterns/AlertModal",
  component: AlertModal,
  args: { title: "Flagged Visitor Alert", banner: null },
} satisfies Meta<typeof AlertModal>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FlaggedVisitor: Story = {
  render: (args) => (
    <AlertModal
      {...args}
      trigger={<Button intent="danger">Open alert</Button>}
      banner={
        <>
          <AlertTitle>Do not check in this visitor</AlertTitle>
          <AlertDescription>
            This visitor matches a watchlist entry and requires Security Manager
            review.
          </AlertDescription>
        </>
      }
      footer={
        <>
          <DialogClose asChild>
            <Button intent="neutral" tone="outline">
              Close
            </Button>
          </DialogClose>
          <Button intent="neutral" tone="soft">
            Add Note
          </Button>
          <Button intent="warning">Escalate to SM</Button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-3">
          <Avatar name="Marcus Cole" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-fg">Marcus Cole</span>
            <span className="text-xs text-fg-muted">Unknown affiliation</span>
          </div>
        </div>
        <Badge intent="warning">Requires SM Review</Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Risk Level</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Flagged At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>
              <Badge intent="danger" dot>
                High
              </Badge>
            </TableCell>
            <TableCell className="text-fg-muted">Watchlist match</TableCell>
            <TableCell className="text-fg-muted">2 Mar, 9:40 AM</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </AlertModal>
  ),
};
