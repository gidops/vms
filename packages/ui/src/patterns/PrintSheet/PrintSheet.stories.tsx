import type { Meta, StoryObj } from "@storybook/react-vite";
import { PrintSheet } from "./PrintSheet";

const meta = {
  title: "Patterns/PrintSheet",
  component: PrintSheet,
  parameters: {
    docs: {
      description: {
        component:
          "Paper-only content (evacuation roll, desk QR poster, access cards). Hidden on screen; while printing it is the only thing on the page. `preview` shows it inline here.",
      },
    },
  },
} satisfies Meta<typeof PrintSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Preview: Story = {
  args: {
    preview: true,
    children: (
      <div style={{ padding: "12mm", fontSize: "10pt" }}>
        <strong style={{ fontSize: "14pt" }}>AATC Evacuation Roll</strong>
        <p style={{ borderBottom: "1px solid var(--color-print-rule)" }}>
          Printed in ink on paper colours, whatever the screen theme.
        </p>
      </div>
    ),
  },
};
