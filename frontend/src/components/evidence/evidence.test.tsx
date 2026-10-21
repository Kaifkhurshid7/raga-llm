import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EvidencePanel from "./EvidencePanel";

describe("EvidencePanel", () => {
  it("renders nothing when the backend supplied no evidence", () => {
    const { container } = render(<EvidencePanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty evidence object", () => {
    const { container } = render(<EvidencePanel evidence={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the status, attributes and sources it was given", () => {
    render(
      <EvidencePanel
        evidence={{
          status: "partial",
          attributes: [
            { label: "Thaat", value: "Kalyan" },
            { label: "Vadi", value: "Ga" },
          ],
          sources: [{ title: "Example reference", url: "https://example.org/yaman", detail: "infobox" }],
        }}
      />
    );
    expect(screen.getByText("Partially supported")).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Vadi" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Example reference" })).toHaveAttribute(
      "href",
      "https://example.org/yaman"
    );
  });

  it("does not turn non-http URLs into links", () => {
    render(
      <EvidencePanel
        evidence={{ sources: [{ title: "Unsafe", url: "javascript:alert(1)" }] }}
      />
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Unsafe")).toBeInTheDocument();
  });
});
