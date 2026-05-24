import { describe, it, expect, vi } from "vitest";
import { nthCallFirstArgString, expectCallWithMessage } from "./test-utils";

describe("test-utils", () => {
  describe("nthCallFirstArgString", () => {
    it("returns first arg of first call as string", () => {
      const spy = vi.fn();
      spy("hello");
      expect(nthCallFirstArgString(spy)).toBe("hello");
    });

    it("returns first arg of nth call when callIndex provided", () => {
      const spy = vi.fn();
      spy("a");
      spy("b");
      spy("c");
      expect(nthCallFirstArgString(spy, 2)).toBe("c");
    });

    it("coerces non-string args via String()", () => {
      const spy = vi.fn();
      spy(42);
      expect(nthCallFirstArgString(spy)).toBe("42");
    });

    it("returns empty string when no call at index", () => {
      const spy = vi.fn();
      expect(nthCallFirstArgString(spy)).toBe("");
      expect(nthCallFirstArgString(spy, 5)).toBe("");
    });

    it("returns empty string when call has zero args", () => {
      const spy = vi.fn();
      spy();
      expect(nthCallFirstArgString(spy)).toBe("undefined");
    });
  });

  describe("expectCallWithMessage", () => {
    it("passes when call count and regex pattern match", () => {
      const spy = vi.fn();
      spy("error: oops");
      expect(() =>
        expectCallWithMessage(spy, /oops/),
      ).not.toThrow();
    });

    it("passes when call count and string contains pattern match", () => {
      const spy = vi.fn();
      spy("hello world");
      expect(() =>
        expectCallWithMessage(spy, "world"),
      ).not.toThrow();
    });

    it("supports custom times option", () => {
      const spy = vi.fn();
      spy("first");
      spy("second");
      expect(() =>
        expectCallWithMessage(spy, /first/, { times: 2 }),
      ).not.toThrow();
    });

    it("supports custom callIndex option", () => {
      const spy = vi.fn();
      spy("a");
      spy("target");
      expect(() =>
        expectCallWithMessage(spy, /target/, { times: 2, callIndex: 1 }),
      ).not.toThrow();
    });

    it("throws when call count mismatches", () => {
      const spy = vi.fn();
      expect(() =>
        expectCallWithMessage(spy, /any/),
      ).toThrow();
    });

    it("throws when regex pattern does not match", () => {
      const spy = vi.fn();
      spy("nope");
      expect(() =>
        expectCallWithMessage(spy, /missing/),
      ).toThrow();
    });

    it("throws when string pattern not contained", () => {
      const spy = vi.fn();
      spy("nope");
      expect(() =>
        expectCallWithMessage(spy, "missing"),
      ).toThrow();
    });
  });
});
