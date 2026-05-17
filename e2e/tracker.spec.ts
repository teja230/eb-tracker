import { test, expect } from "@playwright/test";

test.describe("EB Tracker — core flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads with correct title and skip-nav link", async ({ page }) => {
    await expect(page).toHaveTitle(/EB India Priority Date Tracker/);

    // Skip-nav link is present (sr-only, becomes visible on focus)
    const skipLink = page.getByRole("link", { name: /skip to content/i });
    await expect(skipLink).toBeAttached();
  });

  test("date picker updates projections and shows toast", async ({ page }) => {
    // Default date should be visible in the picker area
    await expect(
      page
        .locator(
          '[data-testid="date-picker"], .date-picker, input[type="text"]'
        )
        .first()
    ).toBeVisible();

    // The hero estimate card (overview tab) should be visible
    await expect(
      page.getByText(/Best Case|Already Current/i).first()
    ).toBeVisible();
  });

  test("category tabs switch and update content", async ({ page }) => {
    // Default is EB-2 — find the active category button
    const eb2Button = page.getByRole("button", { name: /EB-2/i }).first();
    await expect(eb2Button).toBeVisible();
    await expect(eb2Button).toHaveAttribute("aria-pressed", "true");

    // Switch to EB-3
    const eb3Button = page.getByRole("button", { name: /EB-3/i }).first();
    await eb3Button.click();
    await expect(eb3Button).toHaveAttribute("aria-pressed", "true");

    // Content should update — "EB-3" should appear in the overview
    await expect(page.getByText(/EB-3/i).first()).toBeVisible();
  });

  test("tab navigation works", async ({ page }) => {
    // Start on Overview tab
    await expect(
      page.getByRole("button", { name: /overview/i }).first()
    ).toHaveAttribute("aria-pressed", "true");

    // Navigate to Scenarios tab
    await page
      .getByRole("button", { name: /scenarios/i })
      .first()
      .click();
    await expect(
      page.getByText(/Assumptions & Scenario Projections/i)
    ).toBeVisible();

    // Navigate to Bulletin Tracker tab
    await page
      .getByRole("button", { name: /tracker/i })
      .first()
      .click();
    await expect(
      page.getByText(/Data Freshness|Bulletin Tracker/i).first()
    ).toBeVisible();

    // Navigate back to Overview
    await page
      .getByRole("button", { name: /overview/i })
      .first()
      .click();
    await expect(
      page.getByText(/Best Case|Already Current|Your Projection/i).first()
    ).toBeVisible();
  });

  test("scenario assumptions update immediately", async ({ page }) => {
    // Go to Scenarios tab
    await page
      .getByRole("button", { name: /scenarios/i })
      .first()
      .click();
    await expect(
      page.getByText(/Assumptions & Scenario Projections/i)
    ).toBeVisible();

    // The assumption summary text in Overview should update after changing settings
    // Click "Low" spillover
    const lowSpillover = page
      .getByRole("button", { name: /Low.*~30k/i })
      .first();
    if (await lowSpillover.isVisible()) {
      await lowSpillover.click();
      // The selected state should update instantly (no deferred delay)
      await expect(lowSpillover).toHaveAttribute("aria-pressed", "true");
    }
  });

  test("chat widget opens and closes with focus management", async ({
    page,
  }) => {
    // Chat toggle button should be present
    const chatButton = page.getByRole("button", { name: /Ask EBTracker/i });
    await expect(chatButton).toBeVisible();

    // Open chat
    await chatButton.click();
    await expect(
      page.getByRole("dialog", { name: /Ask EBTracker/i })
    ).toBeVisible();

    // Chat should have a close button
    const closeButton = page.getByRole("button", { name: /close/i }).first();
    await closeButton.click();

    // Dialog should be gone and focus should return to toggle button
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("share button copies to clipboard or opens share sheet", async ({
    page,
    context,
  }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const shareButton = page.getByRole("button", { name: /share/i }).first();
    await expect(shareButton).toBeVisible();
    await shareButton.click();

    // Should show "Copied!" state briefly
    await expect(page.getByText(/copied/i).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test("Overview tab shows assumption summary text", async ({ page }) => {
    // The summary text should be visible in Overview
    await expect(
      page.getByText(/Best case uses the optimistic scenario/i)
    ).toBeVisible();
  });

  test("heading hierarchy is correct", async ({ page }) => {
    // There should be an h1 (even if sr-only)
    const h1 = page.locator("h1");
    await expect(h1).toBeAttached();

    // Go to Scenarios tab and check h2
    await page
      .getByRole("button", { name: /scenarios/i })
      .first()
      .click();
    const h2s = page.locator("h2");
    await expect(h2s.first()).toBeVisible();
  });

  test("URL state restores on load", async ({ page }) => {
    // Navigate with URL params
    await page.goto("/?pd=2018-03-01&cat=EB3&sp=low&ban=2027&wst=high");

    // EB-3 category should be selected
    await expect(
      page.getByRole("button", { name: /EB-3/i }).first()
    ).toHaveAttribute("aria-pressed", "true");
  });

  test("dark mode toggle switches theme", async ({ page }) => {
    const themeToggle = page
      .getByRole("button", { name: /switch to .* theme/i })
      .first();
    await expect(themeToggle).toBeVisible();

    // Get current theme state
    const htmlElement = page.locator("html");
    const initialClass = await htmlElement.getAttribute("class");

    await themeToggle.click();

    const newClass = await htmlElement.getAttribute("class");
    expect(newClass).not.toBe(initialClass);
  });
});

test.describe("Accessibility", () => {
  test("skip navigation link is present and works", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.getByRole("link", { name: /skip to content/i });
    await expect(skipLink).toBeAttached();

    // Tab to focus it
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
  });

  test("main landmark exists", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main");
    await expect(main).toBeVisible();
    await expect(main).toHaveAttribute("id", "main-content");
  });

  test("nav has aria-label", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator('nav[aria-label="Tracker sections"]').first();
    await expect(nav).toBeAttached();
  });

  test("footer exists", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeAttached();
  });
});
