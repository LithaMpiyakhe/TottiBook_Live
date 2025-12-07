import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export function apiBase(): string {
  const envAny = (import.meta as any).env || {};
  const base = String(envAny.VITE_API_BASE_URL || envAny.VITE_API_URL || '').replace(/\/+$/, '');
  return base;
}
