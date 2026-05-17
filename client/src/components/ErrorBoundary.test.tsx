/**
 * Component tests for ErrorBoundary
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ErrorBoundary from "./ErrorBoundary";

// A component that throws on demand
function Bomb({ explode }: { explode: boolean }) {
  if (explode) throw new Error("Test explosion");
  return <div>Safe content</div>;
}

describe("ErrorBoundary", () => {
  // Suppress expected console.error from React
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // jsdom doesn't allow reassigning window.location.reload via spyOn
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: vi.fn() },
      writable: true,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <Bomb explode={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("renders fallback UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb explode={true} />
      </ErrorBoundary>
    );
    expect(
      screen.getByText(/An unexpected error occurred/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Reload Page/i)).toBeInTheDocument();
  });

  it("shows the error stack in the fallback UI", () => {
    render(
      <ErrorBoundary>
        <Bomb explode={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Test explosion/i)).toBeInTheDocument();
  });

  it("calls window.location.reload when Reload Page is clicked", () => {
    render(
      <ErrorBoundary>
        <Bomb explode={true} />
      </ErrorBoundary>
    );
    fireEvent.click(screen.getByText(/Reload Page/i));
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
