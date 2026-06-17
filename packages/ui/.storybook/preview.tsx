import { withThemeByDataAttribute } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";
import "../src/styles.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
  },
  globalTypes: {
    direction: {
      description: "Text direction (validates RTL / Arabic layout)",
      defaultValue: "ltr",
      toolbar: {
        title: "Direction",
        icon: "transfer",
        items: [
          { value: "ltr", title: "LTR" },
          { value: "rtl", title: "RTL" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    // Light/dark toggle drives [data-theme] on <html>, matching the token layer.
    withThemeByDataAttribute({
      themes: { Light: "light", Dark: "dark" },
      defaultTheme: "Light",
      attributeName: "data-theme",
    }),
    // Direction toggle drives dir on <html> so logical properties flip for RTL.
    (Story, context) => {
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute(
          "dir",
          (context.globals.direction as string) || "ltr",
        );
      }
      return <Story />;
    },
  ],
};

export default preview;
