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
    <div className="mx-auto flex min-h-full w-full max-w-[720px] flex-col items-center justify-center px-4 py-6 text-center lg:px-6 [@media(min-height:720px)]:py-12">
      <h1 className="max-w-[16em] text-balance font-serif text-[2rem] font-medium leading-[1.1] tracking-tight md:text-[2.5rem] lg:text-[3.25rem]">
        Explore <em className="text-accent">Hindustani</em>{" "}
        <br className="hidden sm:inline" />
        classical music.
      </h1>
      <div className="mt-5 h-px w-14 bg-accent/50" aria-hidden="true" />
      <p className="mt-5 max-w-[620px] text-[15px] leading-relaxed text-muted sm:text-base">
        <span className="block text-balance">Ask about a raga, taal, or musical concept.</span>
        <span className="block text-balance">When evidence is uncertain, RAGA will say so.</span>
      </p>

      <ul
        className="mt-8 flex max-w-[640px] flex-wrap justify-center gap-2.5"
        aria-label="Example questions"
      >
        {HOME_PROMPTS.map((prompt) => (
          <li key={prompt} className="max-w-full">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPrompt(prompt)}
              className="min-h-9 max-w-full rounded-full border border-line bg-raised px-3.5 py-1.5 text-sm leading-5 text-muted transition-colors duration-150 hover:border-faint/50 hover:bg-overlay hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-60"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
