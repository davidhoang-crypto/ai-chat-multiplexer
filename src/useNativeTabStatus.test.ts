import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const invokeSpy = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeSpy(cmd, args),
}));

vi.mock("./appCore", async () => {
  const actual = await vi.importActual<typeof import("./appCore")>("./appCore");
  return {
    ...actual,
    isTauriRuntime: () => true,
  };
});

import { useNativeTabStatus } from "./hooks/useNativeTabStatus";
import type { ChatPane } from "./appCore";

function makePane(id: string, activeTabId: string, url = "https://example.com"): ChatPane {
  return {
    id,
    title: `Pane ${id}`,
    profileId: "prof-default",
    activeTabId,
    tabs: [
      {
        id: activeTabId,
        title: "old title",
        url,
        loadedUrl: url,
      },
    ],
  };
}

describe("useNativeTabStatus", () => {
  beforeEach(() => {
    invokeSpy.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes native_webview_tab_status for each active visible pane", async () => {
    invokeSpy.mockResolvedValue({
      title: "New title",
      url: "https://new.com",
      faviconUrl: "https://new.com/favicon.ico",
      isLoading: false,
    });

    const updateActivePane = vi.fn();
    const panes = [makePane("p1", "t1"), makePane("p2", "t2")];

    renderHook(() =>
      useNativeTabStatus({ activePanes: panes, focusedPaneId: null, updateActivePane }),
    );

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(2));
    expect(invokeSpy.mock.calls[0][0]).toBe("native_webview_tab_status");
  });

  it("only invokes for the focused pane when focus mode is active", async () => {
    invokeSpy.mockResolvedValue({
      title: "X",
      url: "https://x.com",
      faviconUrl: "",
      isLoading: false,
    });

    const updateActivePane = vi.fn();
    const panes = [makePane("p1", "t1"), makePane("p2", "t2")];

    renderHook(() =>
      useNativeTabStatus({ activePanes: panes, focusedPaneId: "p2", updateActivePane }),
    );

    await waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));
  });

  it("calls updateActivePane with new tab status when fields change", async () => {
    invokeSpy.mockResolvedValue({
      title: "Updated title",
      url: "https://updated.com",
      faviconUrl: "https://updated.com/icon.ico",
      isLoading: true,
    });

    const updateActivePane = vi.fn();
    const panes = [makePane("p1", "t1", "https://old.com")];

    renderHook(() =>
      useNativeTabStatus({ activePanes: panes, focusedPaneId: null, updateActivePane }),
    );

    await waitFor(() => expect(updateActivePane).toHaveBeenCalled());
    const [paneId, updater] = updateActivePane.mock.calls[0];
    expect(paneId).toBe("p1");
    const updated = updater(panes[0]);
    expect(updated.tabs[0]).toMatchObject({
      title: "Updated title",
      url: "https://updated.com",
      currentUrl: "https://updated.com",
      faviconUrl: "https://updated.com/icon.ico",
      isLoading: true,
    });
  });

  it("returns the same tab object when nothing changed (stable reference)", async () => {
    const initialPane = makePane("p1", "t1", "https://same.com");
    initialPane.tabs[0] = {
      ...initialPane.tabs[0],
      title: "stable",
      currentUrl: "https://same.com",
      faviconUrl: "https://same.com/favicon.ico",
      isLoading: false,
    };
    invokeSpy.mockResolvedValue({
      title: "stable",
      url: "https://same.com",
      faviconUrl: "https://same.com/favicon.ico",
      isLoading: false,
    });

    const updateActivePane = vi.fn();
    renderHook(() =>
      useNativeTabStatus({
        activePanes: [initialPane],
        focusedPaneId: null,
        updateActivePane,
      }),
    );

    await waitFor(() => expect(updateActivePane).toHaveBeenCalled());
    const updated = updateActivePane.mock.calls[0][1](initialPane);
    expect(updated.tabs[0]).toBe(initialPane.tabs[0]);
  });

  it("skips panes whose activeTabId is missing from tabs list", async () => {
    invokeSpy.mockResolvedValue({
      title: "x",
      url: "https://x",
      faviconUrl: "",
      isLoading: false,
    });

    const broken: ChatPane = {
      id: "p1",
      title: "broken",
      profileId: "prof-default",
      activeTabId: "missing-tab",
      tabs: [
        {
          id: "different-tab",
          title: "x",
          url: "https://x",
          loadedUrl: "https://x",
        },
      ],
    };

    const updateActivePane = vi.fn();
    renderHook(() =>
      useNativeTabStatus({ activePanes: [broken], focusedPaneId: null, updateActivePane }),
    );

    // Wait a tick to ensure no invoke call gets queued.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it("polls every 1200 ms", async () => {
    invokeSpy.mockResolvedValue({
      title: "x",
      url: "https://x",
      faviconUrl: "",
      isLoading: false,
    });

    const updateActivePane = vi.fn();
    const panes = [makePane("p1", "t1")];

    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderHook(() =>
      useNativeTabStatus({ activePanes: panes, focusedPaneId: null, updateActivePane }),
    );

    await vi.waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(1));

    vi.advanceTimersByTime(1200);
    await vi.waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(2));

    vi.advanceTimersByTime(1200);
    await vi.waitFor(() => expect(invokeSpy).toHaveBeenCalledTimes(3));
  });
});
