export const BACKGROUNDS = ["Listener", "Student", "Performer", "Teacher", "Researcher"] as const;

export interface Profile {
  name: string;
  email: string;
  bio: string;
  background: (typeof BACKGROUNDS)[number];
  location: string;
  /** Square JPEG data URL, or null for the initial-letter avatar. */
  photo: string | null;
}

export const DEFAULT_PROFILE: Profile = {
  name: "Kaif Khurshid",
  email: "",
  bio: "",
  background: "Listener",
  location: "",
  photo: null,
};

export const LIMITS = { name: 60, bio: 280, location: 80, email: 120 } as const;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const AVATAR_SIZE_PX = 256;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ProfileErrors {
  name?: string;
  email?: string;
}

export function validateProfile(p: Profile): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!p.name.trim()) errors.name = "Name is required.";
  if (p.email.trim() && !EMAIL_PATTERN.test(p.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  return errors;
}

/** Centre-crops an image file to a small square JPEG so it fits in localStorage. */
export async function imageToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  if (file.size > MAX_PHOTO_BYTES) throw new Error("Image must be under 5 MB.");

  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_SIZE_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE_PX,
    AVATAR_SIZE_PX
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}
