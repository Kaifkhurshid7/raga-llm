/** Starter questions. Each is sent exactly as written. */
export const HOME_PROMPTS = [
  "Explain Raag Yaman.",
  "Compare Raag Yaman and Bhupali.",
  "What are vadi and samvadi?",
  "Is Pa the vadi of Raag Bhairav?",
] as const;

interface Props {
  onPrompt: (query: string) => void;
  disabled?: boolean;
}

export default function HomeScreen({ onPrompt, disabled = false }: Props) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-[640px] flex-col items-center justify-center px-4 py-10 text-center">
      <h1 className="font-serif text-5xl font-medium leading-[1.1] tracking-tight sm:text-6xl">
        Explore <em className="text-accent">Hindustani</em>{" "}
        <br className="hidden sm:inline" />
        classical music.
      </h1>
      <div className="mt-8 h-px w-14 bg-[#C8A46A]" aria-hidden="true" />
      <p className="mt-8 max-w-md text-[17px] leading-7 text-muted">
        Ask about a raga, taal, or musical concept.{" "}
        <br className="hidden sm:inline" />
        When evidence is uncertain, RAGA will say so.
      </p>

      <ul className="mt-10 flex flex-wrap justify-center gap-2" aria-label="Example questions">
        {HOME_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPrompt(prompt)}
              className="rounded-full border border-line px-3.5 py-1.5 text-sm text-muted transition-colors duration-100 hover:bg-overlay hover:text-ink disabled:opacity-60"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
