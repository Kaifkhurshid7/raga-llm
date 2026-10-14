import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { Theme } from "../hooks/useTheme";
import {
  BACKGROUNDS,
  LIMITS,
  imageToAvatar,
  validateProfile,
  type Profile,
} from "../lib/profile";
import Avatar from "./Avatar";

interface Props {
  profile: Profile;
  onSave: (profile: Profile) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
}

const inputClass =
  "w-full rounded-lg border border-line bg-page px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.15)]";

const secondaryButton =
  "h-9 rounded-lg border border-line px-3 text-sm transition-colors duration-100 hover:bg-overlay disabled:opacity-40 disabled:hover:bg-transparent";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-faint">{title}</h2>
      <div className="rounded-xl border border-line bg-raised">{children}</div>
    </section>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  counter?: string;
  children: ReactNode;
}

function Field({ label, htmlFor, error, counter, children }: FieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </label>
        {counter && <span className="text-xs text-faint">{counter}</span>}
      </div>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={`h-9 rounded-lg border px-3 text-sm capitalize transition-colors duration-100 ${
              selected
                ? "border-faint bg-overlay font-medium"
                : "border-line text-muted hover:bg-overlay hover:text-ink"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage({ profile, onSave, theme, onToggleTheme, onBack }: Props) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const errors = validateProfile(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      update("photo", await imageToAvatar(file));
      setPhotoError(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't use that image.");
    }
  }

  function handleSave() {
    if (hasErrors) return;
    const next: Profile = {
      ...draft,
      name: draft.name.trim(),
      email: draft.email.trim(),
      bio: draft.bio.trim(),
      location: draft.location.trim(),
    };
    onSave(next);
    setDraft(next);
    setSaved(true);
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[640px] animate-hero-in space-y-8 px-4 py-8">
          <header>
            <h1 className="font-serif text-2xl">Settings</h1>
            <p className="mt-1 text-sm text-muted">
              Manage your profile and appearance. Stored in this browser only.
            </p>
          </header>

          <Card title="Profile">
            <div className="flex items-center gap-4 border-b border-line p-5">
              <Avatar name={draft.name} photo={draft.photo} className="h-16 w-16 text-xl" />
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondaryButton}
                    onClick={() => fileRef.current?.click()}
                  >
                    {draft.photo ? "Change photo" : "Upload photo"}
                  </button>
                  {draft.photo && (
                    <button
                      type="button"
                      className={secondaryButton}
                      onClick={() => update("photo", null)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-faint">JPG or PNG, up to 5 MB.</p>
                {photoError && (
                  <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {photoError}
                  </p>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
                aria-label="Profile photo"
              />
            </div>

            <div className="space-y-5 p-5">
              <Field label="Name" htmlFor="name" error={errors.name}>
                <input
                  id="name"
                  className={inputClass}
                  value={draft.name}
                  maxLength={LIMITS.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </Field>

              <Field
                label="Bio"
                htmlFor="bio"
                counter={`${draft.bio.length}/${LIMITS.bio}`}
              >
                <textarea
                  id="bio"
                  rows={3}
                  className={`${inputClass} resize-none`}
                  value={draft.bio}
                  maxLength={LIMITS.bio}
                  placeholder="A line or two about you and your music."
                  onChange={(e) => update("bio", e.target.value)}
                />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Email" htmlFor="email" error={errors.email}>
                  <input
                    id="email"
                    type="email"
                    className={inputClass}
                    value={draft.email}
                    maxLength={LIMITS.email}
                    placeholder="you@example.com"
                    onChange={(e) => update("email", e.target.value)}
                  />
                </Field>

                <Field label="Location" htmlFor="location">
                  <input
                    id="location"
                    className={inputClass}
                    value={draft.location}
                    maxLength={LIMITS.location}
                    placeholder="City, country"
                    onChange={(e) => update("location", e.target.value)}
                  />
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium">Musical background</p>
                <Segmented
                  label="Musical background"
                  options={BACKGROUNDS}
                  value={draft.background}
                  onChange={(v) => update("background", v)}
                />
              </div>
            </div>
          </Card>

          <Card title="Appearance">
            <div className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm font-medium">Theme</p>
                <p className="mt-0.5 text-xs text-faint">Applies immediately.</p>
              </div>
              <Segmented
                label="Theme"
                options={["light", "dark"] as const}
                value={theme}
                onChange={(t) => t !== theme && onToggleTheme()}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-page">
        <div className="mx-auto flex max-w-[640px] items-center gap-3 px-4 py-3">
          <button
            type="submit"
            disabled={!dirty || hasErrors}
            className="h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent"
          >
            Save changes
          </button>
          <button
            type="button"
            className={secondaryButton}
            disabled={!dirty}
            onClick={() => {
              setDraft(profile);
              setPhotoError(null);
            }}
          >
            Discard
          </button>
          <span role="status" className="text-sm text-muted">
            {saved && !dirty ? "Saved" : dirty ? "Unsaved changes" : ""}
          </span>
        </div>
      </div>
    </form>
  );
}
