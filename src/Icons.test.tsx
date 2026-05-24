import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import {
  AppLogo,
  AppWordmark,
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconDownload,
  IconEdit,
  IconExternal,
  IconMaximize,
  IconMinimize,
  IconMoon,
  IconPlus,
  IconRefresh,
  IconSettings,
  IconSun,
  IconTrash,
  IconUpload,
  IconX,
} from "./Icons";

afterEach(cleanup);

const strokedIcons = [
  ["IconChevronDown", IconChevronDown],
  ["IconX", IconX],
  ["IconPlus", IconPlus],
  ["IconEdit", IconEdit],
  ["IconTrash", IconTrash],
  ["IconSun", IconSun],
  ["IconMoon", IconMoon],
  ["IconMaximize", IconMaximize],
  ["IconMinimize", IconMinimize],
  ["IconArrowLeft", IconArrowLeft],
  ["IconArrowRight", IconArrowRight],
  ["IconRefresh", IconRefresh],
  ["IconCheck", IconCheck],
  ["IconSettings", IconSettings],
  ["IconDownload", IconDownload],
  ["IconUpload", IconUpload],
  ["IconExternal", IconExternal],
] as const;

describe("Icons", () => {
  it.each(strokedIcons)("renders %s as a 16x16 SVG by default", (_name, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
  });

  it("uses the size prop to set width and height", () => {
    const { container } = render(<IconPlus size={32} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("height")).toBe("32");
  });

  it("forwards extra SVG props (e.g. className, role)", () => {
    const { container } = render(<IconCheck className="custom" role="img" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toBe("custom");
    expect(svg.getAttribute("role")).toBe("img");
  });

  it("AppLogo renders a 22x22 SVG by default with the gradient defs", () => {
    const { container } = render(<AppLogo />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("22");
    expect(svg.getAttribute("height")).toBe("22");
    expect(container.querySelector("linearGradient#acm-logo-grad")).not.toBeNull();
    expect(container.querySelectorAll("rect").length).toBeGreaterThanOrEqual(4);
  });

  it("AppLogo accepts a custom size prop", () => {
    const { container } = render(<AppLogo size={40} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("height")).toBe("40");
  });

  it("AppWordmark renders text 'AI Multiplexer' inside an SVG with role=img", () => {
    const { container } = render(<AppWordmark />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("AI Multiplexer");
    expect(container.querySelector("text")?.textContent).toBe("AI Multiplexer");
  });
});
