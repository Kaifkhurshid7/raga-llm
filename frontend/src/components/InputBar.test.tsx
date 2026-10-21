import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InputBar from "./InputBar";

function setup(overrides: Partial<React.ComponentProps<typeof InputBar>> = {}) {
  const props = {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onStop: vi.fn(),
    generating: false,
    ...overrides,
  };
  render(<InputBar {...props} />);
  return props;
}

describe("InputBar", () => {
  it("sends on Enter when there is text", async () => {
    const { onSubmit } = setup({ value: "What is a vadi?" });
    await userEvent.type(screen.getByLabelText("Message"), "{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not send on Shift+Enter", async () => {
    const { onSubmit } = setup({ value: "line one" });
    await userEvent.type(screen.getByLabelText("Message"), "{Shift>}{Enter}{/Shift}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not send an empty or whitespace-only message", async () => {
    const { onSubmit } = setup({ value: "   " });
    await userEvent.type(screen.getByLabelText("Message"), "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("keeps the field editable and disables sending while generating", async () => {
    const { onSubmit, onStop } = setup({ value: "next question", generating: true });
    const field = screen.getByLabelText("Message");
    expect(field).toBeEnabled();
    await userEvent.type(field, "{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
