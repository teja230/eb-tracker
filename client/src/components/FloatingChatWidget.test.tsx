/**
 * Component tests for FloatingChatWidget
 * Tests open/close behavior, focus management, Escape key, and accessibility.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { FloatingChatWidget } from "./FloatingChatWidget";
import type { AskEBTrackerProps } from "./trackerTypes";

// Minimal stub for required props
const stubProps: Omit<AskEBTrackerProps, "onClose"> = {
  categoryLabel: "EB-2 India",
  categoryName: "eb2India",
  targetDate: "2021-01-01",
  currentFad: "2015-01-01",
  currentDof: "2013-01-01",
  projections: {},
  scenarios: {},
  assumptionsSummary: "Test assumptions",
  backtest: {
    meanAbsErrorMonths: 2,
    within1MonthPct: 0.5,
    within3MonthPct: 0.75,
    within6MonthPct: 0.9,
    sampleCount: 5,
  } as AskEBTrackerProps["backtest"],
  sourceLinks: [],
};

describe("FloatingChatWidget", () => {
  it("renders the toggle button by default", () => {
    render(<FloatingChatWidget {...stubProps} />);
    expect(
      screen.getByRole("button", { name: /ask ebtracker/i })
    ).toBeInTheDocument();
  });

  it("does not render the chat panel when closed", () => {
    render(<FloatingChatWidget {...stubProps} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the chat panel when the toggle button is clicked", async () => {
    render(<FloatingChatWidget {...stubProps} />);
    const btn = screen.getByRole("button", { name: /ask ebtracker/i });
    await userEvent.click(btn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes the chat panel when the close button inside is clicked", async () => {
    render(<FloatingChatWidget {...stubProps} />);
    await userEvent.click(
      screen.getByRole("button", { name: /ask ebtracker/i })
    );
    // Click the inner panel's X button (has title="Close", not aria-label)
    const closeBtn = screen.getByTitle("Close");
    await userEvent.click(closeBtn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the chat panel when Escape is pressed", async () => {
    render(<FloatingChatWidget {...stubProps} />);
    await userEvent.click(
      screen.getByRole("button", { name: /ask ebtracker/i })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
