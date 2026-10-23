import { expect, test } from "@playwright/test";

const email = process.env.SMOKE_EMAIL ?? "";
const password = process.env.SMOKE_PASSWORD ?? "";

test.describe("V1 gap smoke (Security Manager)", () => {
  test.skip(!email || !password, "Set SMOKE_EMAIL and SMOKE_PASSWORD");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/admin/);
  });

  test("opens the Evacuation Roll", async ({ page }) => {
    await page.goto("/admin/evacuation");
    await expect(
      page.getByRole("heading", { name: "Evacuation Roll" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Print for wardens" }),
    ).toBeVisible();
  });

  test("opens Comms Opt-ins with export and withdraw", async ({ page }) => {
    await page.goto("/admin/opt-ins");
    await expect(
      page.getByRole("heading", { name: "Comms Opt-ins" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Export CSV/ }),
    ).toBeVisible();
    await expect(page.getByText("Withdraw consent")).toBeVisible();
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
    await expect(
      page.getByRole("heading", { name: "Analytics & Reports" }),
    ).toBeVisible();
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
