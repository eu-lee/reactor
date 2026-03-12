import { useState, useEffect } from "react";

const STORAGE_KEY = "reactor-anthropic-key";

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  });

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem(STORAGE_KEY, apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [apiKey]);

  return { apiKey, setApiKey, hasKey: apiKey.length > 0 };
}
