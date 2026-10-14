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
import { ArrowLeftIcon } from "./icons";

interface Props {
  profile: Profile;
  onSave: (profile: Profile) => void;
  theme: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
}

const fieldClass =
  "w-full rounded-lg border border-line bg-raised px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_rgb(var(--accent)/0.15)]";

const buttonClass =
  "rounded-lg border border-line px-3 py-2 text-sm transition-colors duration-100 hover:bg-overlay disabled:opacity-40 disabled:hover:bg-transparent";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>
      )}
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
    <div className="flex-1 overflow-y-auto">
      <form
        className="mx-auto max-w-[640px] animate-hero-in px-4 py-8"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 mb-4 flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors duration-100 hover:bg-overlay hover:text-ink"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to chat
        </button>
        <h1 className="font-serif text-2xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">Your profile is stored in this browser only.</p>

        <section className="mt-8">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-faint">Profile</h2>

          <div className="mb-6 flex items-center gap-4">
            <Avatar name={draft.name} photo={draft.photo} className="h-20 w-20 text-2xl" />
            <div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => fileRef.current?.click()}
                >
                  {draft.photo ? "Change photo" : "Upload photo"}
                </button>
                {draft.photo && (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => update("photo", null)}
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-faint">JPG or PNG, up to 5 MB. Cropped to a square.</p>
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

          <div className="space-y-5">
            <Field label="Name" htmlFor="name" error={errors.name}>
              <input
                id="name"
                className={fieldClass}
                value={draft.name}
                maxLength={LIMITS.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>

            <Field label="Bio" htmlFor="bio" hint={`${draft.bio.length}/${LIMITS.bio}`}>
              <textarea
                id="bio"
                rows={3}
                className={`${fieldClass} resize-none`}
                value={draft.bio}
                maxLength={LIMITS.bio}
                placeholder="A line or two about you and your music."
                onChange={(e) => update("bio", e.target.value)}
              />
            </Field>

            <Field label="Email" htmlFor="email" error={errors.email}>
              <input
                id="email"
                type="email"
                className={fieldClass}
                value={draft.email}
                maxLength={LIMITS.email}
                placeholder="you@example.com"
                onChange={(e) => update("email", e.target.value)}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Musical background" htmlFor="background">
                <select
                  id="background"
                  className={fieldClass}
                  value={draft.background}
                  onChange={(e) => update("background", e.target.value as Profile["background"])}
                >
                  {BACKGROUNDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Location" htmlFor="location">
                <input
                  id="location"
                  className={fieldClass}
                  value={draft.location}
                  maxLength={LIMITS.location}
                  placeholder="City, country"
                  onChange={(e) => update("location", e.target.value)}
                />
              </Field>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-faint">
            Appearance
          </h2>
          <div
            className="inline-flex rounded-lg border border-line p-1"
            role="group"
            aria-label="Theme"
          >
            {(["light", "dark"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={theme === t}
                onClick={() => theme !== t && onToggleTheme()}
                className={`rounded-md px-4 py-1.5 text-sm capitalize transition-colors duration-100 ${
                  theme === t ? "bg-overlay font-medium" : "text-muted hover:text-ink"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-10 flex items-center gap-3 border-t border-line pt-6">
          <button
            type="submit"
            disabled={!dirty || hasErrors}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors duration-150 hover:bg-accent-hover disabled:opacity-40 disabled:hover:bg-accent"
          >
            Save changes
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={!dirty}
            onClick={() => {
              setDraft(profile);
              setPhotoError(null);
            }}
          >
            Discard
          </button>
          <span role="status" className="text-sm text-muted">
            {saved && !dirty ? "Saved" : ""}
          </span>
        </div>
      </form>
    </div>
  );
}
