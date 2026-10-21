import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import HomeScreen, { HOME_PROMPTS } from "./HomeScreen";

describe("HomeScreen", () => {
  it("shows the headline, the subtext and a handful of example questions", () => {
    render(<HomeScreen onPrompt={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Explore Hindustani classical music."
    );
    expect(screen.getByText(/When evidence is uncertain, RAGA will say so\./)).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(HOME_PROMPTS.length);
    expect(HOME_PROMPTS.length).toBeGreaterThanOrEqual(3);
  });

  it("sends the suggestion exactly as written", async () => {
    const onPrompt = vi.fn();
    render(<HomeScreen onPrompt={onPrompt} />);
    await userEvent.click(screen.getByRole("button", { name: "What are vadi and samvadi?" }));
    expect(onPrompt).toHaveBeenCalledWith("What are vadi and samvadi?");
  });

  it("is keyboard operable", async () => {
    const onPrompt = vi.fn();
    render(<HomeScreen onPrompt={onPrompt} />);
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onPrompt).toHaveBeenCalledWith(HOME_PROMPTS[0]);
  });

  it("does not claim verification it cannot back up", () => {
    render(<HomeScreen onPrompt={vi.fn()} />);
    expect(screen.queryByText(/verified|grounded/i)).not.toBeInTheDocument();
  });
});
