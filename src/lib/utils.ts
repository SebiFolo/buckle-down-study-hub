import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripMarkup(s?: string | null) {
  if (!s) return "";
  // Remove common markdown characters and control sequences
  return s
    .replace(/[#*_>`~()[\]]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
