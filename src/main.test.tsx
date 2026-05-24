import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// main.tsx executes top-level: ReactDOM.createRoot(document.getElementById("root")).render(<App/>).
// We mock react-dom/client and ./App to avoid actually mounting React, then dynamic-import
// main.tsx so its top-level statements run and register coverage.

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock, unmount: () => undefined }));

vi.mock("react-dom/client", () => ({
  default: { createRoot: createRootMock },
  createRoot: createRootMock,
}));

vi.mock("./App", () => ({
  default: () => null,
}));

describe("main.tsx entry point", () => {
  beforeEach(() => {
    // Ensure a #root element exists so getElementById doesn't return null.
    if (!document.getElementById("root")) {
      const root = document.createElement("div");
      root.id = "root";
      document.body.appendChild(root);
    }
    vi.resetModules();
    createRootMock.mockClear();
    renderMock.mockClear();
  });

  afterEach(() => {
    document.getElementById("root")?.remove();
  });

  it("creates a React root on #root and renders <App/> in StrictMode", async () => {
    await import("./main");
    expect(createRootMock).toHaveBeenCalledTimes(1);
    const arg = createRootMock.mock.calls[0][0] as HTMLElement;
    expect(arg).toBeInstanceOf(HTMLElement);
    expect(arg.id).toBe("root");
    expect(renderMock).toHaveBeenCalledTimes(1);
  });
});
