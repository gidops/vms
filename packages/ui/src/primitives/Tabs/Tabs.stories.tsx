import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

const meta = {
  title: "Primitives/Tabs",
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="inbox" className="w-96">
      <TabsList>
        <TabsTrigger value="inbox">All Inbox</TabsTrigger>
        <TabsTrigger value="requests">Requests</TabsTrigger>
        <TabsTrigger value="alerts">Alerts</TabsTrigger>
      </TabsList>
      <TabsContent value="inbox" className="text-sm text-fg-muted">
        All inbox items.
      </TabsContent>
      <TabsContent value="requests" className="text-sm text-fg-muted">
        Visit requests awaiting action.
      </TabsContent>
      <TabsContent value="alerts" className="text-sm text-fg-muted">
        Flagged visitor alerts.
      </TabsContent>
    </Tabs>
  ),
};
