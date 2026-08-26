/**
 * Design: verify the concise personal milestone timeline remains explicit when
 * a live cutoff is unavailable, without exposing a forecast model anchor.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PersonalTimeline } from "./PersonalTimeline";

const projection = {
  dofDate: new Date(2027, 9, 11),
  fadDate: new Date(2028, 3, 13),
  gcDate: new Date(2029, 6, 14),
  horizon: {
    dofP50Capped: false,
    fadP50Capped: false,
    gcP50Capped: false,
  },
};

describe("PersonalTimeline", () => {
  it("keeps an unavailable live FAD explicit while showing the next modeled milestone", () => {
    render(
      <PersonalTimeline
        categoryLabel="EB-2"
        targetDate="2016-08-01"
        currentFad="2014-07-15"
        currentFadStatus="unavailable"
        currentDof="2015-01-15"
        projection={projection as never}
        gcLagMonths={15}
      />
    );

    expect(screen.getByText("Unavailable now")).toBeInTheDocument();
    expect(
      screen.getByText(/no visa numbers are currently available/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Oct 11, 2027")).toBeInTheDocument();
  });
});
