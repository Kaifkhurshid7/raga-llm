import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ChatMessage from "./ChatMessage";

describe("ChatMessage (assistant)", () => {
  it("renders markdown, including tables that can scroll", () => {
    render(
      <ChatMessage
        role="assistant"
        content={"**Yaman** uses:\n\n- tivra Ma\n\n| Note | Role |\n|---|---|\n| Ga | vadi |"}
        canAct
      />
    );
    expect(screen.getByText("Yaman").tagName).toBe("STRONG");
    expect(screen.getByRole("listitem")).toHaveTextContent("tivra Ma");
    expect(screen.getByRole("table").parentElement).toHaveClass("overflow-x-auto");
  });

  it("copies the answer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<ChatMessage role="assistant" content="Ga is the vadi." canAct />);

    await userEvent.click(screen.getByRole("button", { name: "Copy response" }));

    expect(writeText).toHaveBeenCalledWith("Ga is the vadi.");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("offers regenerate only when the message supports it and nothing is running", async () => {
    const onRegenerate = vi.fn();
    const { rerender } = render(
      <ChatMessage role="assistant" content="x" canAct onRegenerate={onRegenerate} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Regenerate response" }));
    expect(onRegenerate).toHaveBeenCalledTimes(1);

    rerender(<ChatMessage role="assistant" content="x" canAct={false} onRegenerate={onRegenerate} />);
    expect(screen.queryByRole("button", { name: "Regenerate response" })).not.toBeInTheDocument();

    rerender(<ChatMessage role="assistant" content="x" canAct />);
    expect(screen.queryByRole("button", { name: "Regenerate response" })).not.toBeInTheDocument();
  });

  it("shows no evidence UI when none was supplied", () => {
    render(<ChatMessage role="assistant" content="Ga is the vadi." canAct />);
    expect(screen.queryByTestId("evidence-panel")).not.toBeInTheDocument();
  });
});

describe("ChatMessage (user)", () => {
  it("edits and resubmits with the new text", async () => {
    const onEdit = vi.fn();
    render(<ChatMessage role="user" content="old question" canAct onEdit={onEdit} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    const field = screen.getByLabelText("Edit your message");
    expect(field).toHaveValue("old question");
    await userEvent.clear(field);
    await userEvent.type(field, "new question{Enter}");

    expect(onEdit).toHaveBeenCalledWith("new question");
    expect(screen.queryByLabelText("Edit your message")).not.toBeInTheDocument();
  });

  it("does not resubmit unchanged or empty text, and Escape cancels", async () => {
    const onEdit = vi.fn();
    render(<ChatMessage role="user" content="same" canAct onEdit={onEdit} />);

    await userEvent.click(screen.getByRole("button", { name: "Edit message" }));
    expect(screen.getByRole("button", { name: "Save and resend" })).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Edit your message"), "{Escape}");

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("same")).toBeInTheDocument();
  });

  it("hides editing while a request is running", () => {
    render(<ChatMessage role="user" content="q" canAct={false} onEdit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Edit message" })).not.toBeInTheDocument();
  });
});
