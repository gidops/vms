import { expect, test } from "@playwright/test";

const email = process.env.SMOKE_EMAIL ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";

test.describe("V1 gap smoke (Security Manager)", () => {
  test.skip(!email || !password, "Set SMOKE_EMAIL and SMOKE_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/admin/);
  });

  test("opens the Evacuation Roll", async ({ page }) => {
    await page.goto("/admin/evacuation");
    await expect(
      page.getByRole("radio", { name: "Evacuation Roll" }),
    ).toBeChecked();
    await expect(
      page.getByRole("button", { name: "Print", exact: true }),
    ).toBeVisible();
  });

  test("opens Email consent read-only, with export", async ({ page }) => {
    // Redirects to Insights → Visitors; Email consent is a view there (no heading).
    await page.goto("/admin/opt-ins");
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
    await page.goto("/admin/analytics");
    await expect(page.getByRole("radio", { name: "Analytics" })).toBeChecked();
    await expect(page.getByText("Status Breakdown")).toBeVisible();
  });

  test("opens the visitor export dialog", async ({ page }) => {
    await page.goto("/admin");
    // The overview bar's Export action (desktop bar; the mobile copy is hidden).
    await page
      .getByTestId("overview-bar-desktop")
      .getByRole("button", { name: "Export", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Export Visitor Data");
    await expect(dialog.getByRole("button", { name: "Export" })).toBeVisible();
  });
});
