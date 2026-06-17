import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { Button } from "../../primitives/Button/Button";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "./Toast";

const meta = {
  title: "Components/Toast",
  component: Toast,
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

function ToastDemo() {
  const [open, setOpen] = React.useState(false);
  return (
    <ToastProvider swipeDirection="right">
      <Button
        onClick={() => {
          setOpen(false);
          window.setTimeout(() => setOpen(true), 50);
        }}
      >
        Show toast
      </Button>
      <Toast intent="success" open={open} onOpenChange={setOpen}>
        <div className="flex flex-col gap-1 pe-6">
          <ToastTitle>Visit approved</ToastTitle>
          <ToastDescription>The visitor has been notified.</ToastDescription>
        </div>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  );
}

export const Default: Story = {
  render: () => <ToastDemo />,
};
