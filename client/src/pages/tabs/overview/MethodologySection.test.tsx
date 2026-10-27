import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MethodologySection } from "./MethodologySection";

describe("methodology source disclosure", () => {
  it("shows Q3 receipt flow even when the detailed methodology is collapsed", () => {
    render(
      <MethodologySection
        showMethodology={false}
        setShowMethodology={vi.fn()}
        trackerSourceLinks={[]}
      />
    );
    expect(screen.getByText(/India I-140 receipt flow/)).toBeVisible();
    expect(screen.getByText(/EB-2: 12,231/)).toHaveTextContent("EB-3: 3,617");
    expect(screen.getByText(/19,549 petitions received/)).toHaveTextContent(
      "does not directly change the queue or forecast"
    );
    expect(
      screen.getByRole("button", { name: /Show methodology/ })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText(/Probabilistic Dual-Cutoff/)
    ).not.toBeInTheDocument();
  });
});
