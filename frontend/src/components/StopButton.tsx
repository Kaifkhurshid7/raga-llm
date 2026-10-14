interface Props {
  onClick: () => void;
  /** Rendered over the send button; fades in while a reply is generating. */
  visible: boolean;
}

export default function StopButton({ onClick, visible }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Stop generating"
      title="Stop generating"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`absolute inset-0 flex items-center justify-center rounded-full bg-overlay text-ink transition-[opacity,transform] duration-150 ease-out active:scale-95 ${
        visible ? "animate-stop-glow opacity-100" : "pointer-events-none scale-90 opacity-0"
      }`}
    >
      <span className="h-3 w-3 rounded-[2px] bg-current" />
    </button>
  );
}
