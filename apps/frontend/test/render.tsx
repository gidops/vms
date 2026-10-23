import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type * as React from "react";
import messages from "@/messages/en.json";

/** Render with the real English messages and a fresh QueryClient. */
export function renderWithIntl(ui: React.ReactElement, opts?: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider
        locale="en"
        messages={messages}
        timeZone="Africa/Lagos"
      >
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
    opts,
  );
}
