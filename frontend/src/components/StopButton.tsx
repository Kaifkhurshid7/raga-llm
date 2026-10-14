interface Props {
  onClick: () => void;
}

export default function StopButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Stop generating"
      title="Stop generating"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg"
    >
      <span className="h-3 w-3 rounded-[2px] bg-current" />
    </button>
  );
}
