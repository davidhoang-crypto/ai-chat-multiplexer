// New Tab page configuration.
// In production (Tauri), the frontend is served from tauri://localhost so we can
// reference public/newtab.html directly. In dev (Vite), Vite serves /newtab.html.

export const NEW_TAB_TITLE = "New Tab";

const NEW_TAB_PATH = "/newtab.html";

export function getNewTabUrl(): string {
  if (typeof window === "undefined") return NEW_TAB_PATH;
  // Build an absolute URL using the current origin so the webview keeps it stable.
  return new URL(NEW_TAB_PATH, window.location.href).toString();
}

export function isNewTabUrl(url: string): boolean {
  if (!url) return false;
  // Strip query/hash and trailing slashes for comparison
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.pathname === NEW_TAB_PATH;
  } catch {
    return url.endsWith(NEW_TAB_PATH);
  }
}
