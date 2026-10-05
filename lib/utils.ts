import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const id = () => crypto.randomUUID();
export const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export async function retry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 250): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try { return await fn(); } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      await sleep(delayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
