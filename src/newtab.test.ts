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
});
