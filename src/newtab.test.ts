import { describe, expect, it } from "vitest";
import { getNewTabUrl, isNewTabUrl, NEW_TAB_TITLE } from "./newtab";

describe("NEW_TAB_TITLE", () => {
  it("is a non-empty string", () => {
    expect(NEW_TAB_TITLE).toBeTypeOf("string");
    expect(NEW_TAB_TITLE.length).toBeGreaterThan(0);
  });
});

describe("getNewTabUrl", () => {
  it("returns an absolute URL pointing to /newtab.html", () => {
    const url = getNewTabUrl();
    expect(url).toMatch(/\/newtab\.html$/);
    expect(() => new URL(url)).not.toThrow();
  });

  it("returns the bare path when window is undefined (line 10 SSR guard)", () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    delete (globalThis as { window?: unknown }).window;
    try {
      // typeof window is evaluated at call time; with window removed from
      // globalThis the SSR guard short-circuits to NEW_TAB_PATH.
      expect(getNewTabUrl()).toBe("/newtab.html");
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });
});

describe("isNewTabUrl", () => {
  it("returns false for empty input", () => {
    expect(isNewTabUrl("")).toBe(false);
  });

  it("matches the canonical /newtab.html path", () => {
    expect(isNewTabUrl("http://localhost:1420/newtab.html")).toBe(true);
    expect(isNewTabUrl("/newtab.html")).toBe(true);
    expect(isNewTabUrl(getNewTabUrl())).toBe(true);
  });

  it("returns false for unrelated URLs", () => {
    expect(isNewTabUrl("https://chatgpt.com")).toBe(false);
    expect(isNewTabUrl("https://example.com/newtab.html.bak")).toBe(false);
  });

  it("falls back to endsWith comparison when URL constructor throws", () => {
    const OriginalURL = globalThis.URL;
    // @ts-expect-error -- temporarily override
    globalThis.URL = function FakeURL() {
      throw new Error("forced parse failure");
    };
    try {
      expect(isNewTabUrl("/newtab.html")).toBe(true);
      expect(isNewTabUrl("/something-else")).toBe(false);
    } finally {
      globalThis.URL = OriginalURL;
    }
  });
});
