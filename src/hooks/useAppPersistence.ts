import { useEffect, useState } from "react";
import {
  STORAGE_KEY,
  THEME_STORAGE_KEY,
  loadAppState,
  type AppState,
  type ThemeMode,
} from "../appCore";

export interface UseAppPersistenceResult {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  theme: ThemeMode;
  setTheme: React.Dispatch<React.SetStateAction<ThemeMode>>;
}

export function useAppPersistence(): UseAppPersistenceResult {
  const [state, setState] = useState<AppState>(() => loadAppState());
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return savedTheme === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return { state, setState, theme, setTheme };
}
