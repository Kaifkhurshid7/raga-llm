import { useCallback, useState } from "react";
import { DEFAULT_PROFILE, type Profile } from "../lib/profile";
import { readStorage, writeStorage } from "../lib/storage";

const KEY = "raga.profile";

export function useProfile(): [Profile, (next: Profile) => void] {
  const [profile, setProfile] = useState<Profile>(() => ({
    ...DEFAULT_PROFILE,
    ...readStorage<Partial<Profile>>(KEY, {}),
  }));

  const save = useCallback((next: Profile) => {
    setProfile(next);
    writeStorage(KEY, next);
  }, []);

  return [profile, save];
}
