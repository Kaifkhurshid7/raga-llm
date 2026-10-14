interface Props {
  name: string;
  photo: string | null;
  /** Controls size and text size. */
  className?: string;
}

/** Profile photo, or the first initial when there is none. */
export default function Avatar({ name, photo, className = "h-8 w-8 text-sm" }: Props) {
  const base = `shrink-0 rounded-full ${className}`;
  if (photo) {
    return <img src={photo} alt="" className={`${base} object-cover`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${base} flex items-center justify-center bg-overlay font-medium text-muted`}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}
