const STORAGE_KEY = "aura_gemini_api_key";

export function getGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    const localKey = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (localKey) {
      return localKey;
    }
  }

  return (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || "";
}

export function setGeminiApiKey(apiKey: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = apiKey.trim();
  if (trimmed) {
    window.localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasGeminiApiKey(): boolean {
  return Boolean(getGeminiApiKey());
}

