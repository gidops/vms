import { expect, test } from "@playwright/test";

const email = process.env.SMOKE_EMAIL ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";

test.describe("Security Manager smoke", () => {
  test.skip(!email || !password, "Set SMOKE_EMAIL and SMOKE_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/admin/);
  });

  test("opens the Evacuation Roll", async ({ page }) => {
    await page.goto("/insights?tab=evacuation");
    await expect(
      page.getByRole("radio", { name: "Evacuation Roll" }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Print", exact: true }),
    ).toBeVisible();
  });

  test("opens Email consent read-only, with export", async ({ page }) => {
    // Email consent is a view inside Insights → Visitors (no heading).
    await page.goto("/insights?tab=visitors");
    await page.getByRole("radio", { name: "Email consent" }).click();
    await expect(
      page.getByRole("radio", { name: "Email consent" }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: /Export CSV/ }),
    ).toBeVisible();
    // The Security Manager can't add or remove consent.
    await expect(
      page.getByRole("button", { name: "Withdraw consent" }),
    ).toHaveCount(0);
  });

  test("leads the overview with approvals and moves trends to Analytics", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(
      page.getByTestId("overview-bar-desktop").getByText("Awaiting approval"),
    ).toBeVisible();
    await expect(page.getByText("Status Breakdown")).toHaveCount(0);
    await page.goto("/insights?tab=analytics");
    await expect(page.getByRole("radio", { name: "Analytics" })).toBeChecked();
    await expect(page.getByText("Status Breakdown")).toBeVisible();
  });

  test("opens the visitor export dialog", async ({ page }) => {
    // Export lives on Insights → History, not the admin overview.
    await page.goto("/insights?tab=history");
    await page.getByRole("button", { name: "Export", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Export Visitor Data");
    await expect(dialog.getByRole("button", { name: "Export" })).toBeVisible();
  });
});
