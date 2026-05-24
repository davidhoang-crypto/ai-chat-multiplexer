import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import {
  IconArrowLeft,
  IconArrowRight,
  IconMaximize,
  IconMinimize,
  IconPlus,
  IconRefresh,
  IconX,
} from "../Icons";
import {
  getDisplayUrl,
  getTabKey,
  getTabTitle,
  isPaneDragControl,
  normalizeUrl,
  type ChatPane,
  type ChatTab,
  type Profile,
} from "../appCore";

type PaneDragRef = MutableRefObject<{
  paneId: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
} | null>;

type TabDragRef = MutableRefObject<{
  paneId: string;
  tabId: string;
  pointerId: number;
  startX: number;
  startY: number;
  active: boolean;
} | null>;

type TabDragOver = {
  paneId: string;
  tabId: string | null;
  before: boolean;
} | null;

export interface PaneProps {
  // Data
  pane: ChatPane;
  index: number;
  paneProfile: Profile | undefined;
  activePanes: ChatPane[];

  // UI state
  isFocused: boolean;
  focusedPaneId: string | null;
  dragOverPaneId: string | null;
  draggingTabKey: string | null;
  tabDragOver: TabDragOver;
  editingUrls: Record<string, string>;

  // Refs
  paneDrag: PaneDragRef;
  tabDrag: TabDragRef;
  registerShellRef: (paneId: string, element: HTMLDivElement | null) => void;

  // State setters
  setFocusedPaneId: (id: string | null) => void;
  setDraggingPaneId: (id: string | null) => void;
  setDragOverPaneId: (id: string | null) => void;
  setDraggingTabKey: (key: string | null) => void;
  setTabDragOver: (next: TabDragOver) => void;
  setEditingUrls: (
    updater: (current: Record<string, string>) => Record<string, string>,
  ) => void;

  // Actions
  addTab: (paneId: string) => void;
  removeTab: (paneId: string, tabId: string) => void;
  removePane: (paneId: string) => void;
  updateActivePane: (paneId: string, updater: (pane: ChatPane) => ChatPane) => void;
  navigateActiveWebview: (
    paneId: string,
    tab: ChatTab,
    action: "back" | "forward" | "reload",
  ) => void;
  startEditingUrl: (paneId: string, tab: ChatTab) => void;
  updateEditingUrl: (paneId: string, tabId: string, value: string) => void;
  commitTabUrl: (paneId: string, tabId: string) => void;
  finishPaneDrag: (clientX: number, clientY: number) => void;
  moveTabWithinPane: (
    paneId: string,
    sourceTabId: string,
    targetTabId: string,
    before: boolean,
  ) => void;
  moveTabAcrossPanes: (
    sourcePaneId: string,
    sourceTabId: string,
    targetPaneId: string,
    targetTabId: string | null,
    before: boolean,
  ) => void;
  detachTabToNewPane: (sourcePaneId: string, sourceTabId: string) => void;
}

export function Pane({
  pane,
  index,
  paneProfile,
  activePanes,
  isFocused,
  focusedPaneId,
  dragOverPaneId,
  draggingTabKey,
  tabDragOver,
  editingUrls,
  paneDrag,
  tabDrag,
  registerShellRef,
  setFocusedPaneId,
  setDraggingPaneId,
  setDragOverPaneId,
  setDraggingTabKey,
  setTabDragOver,
  setEditingUrls,
  addTab,
  removeTab,
  removePane,
  updateActivePane,
  navigateActiveWebview,
  startEditingUrl,
  updateEditingUrl,
  commitTabUrl,
  finishPaneDrag,
  moveTabWithinPane,
  moveTabAcrossPanes,
  detachTabToNewPane,
}: PaneProps) {
  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeTabId) ?? pane.tabs[0];
  const activeUrl = normalizeUrl(activeTab.loadedUrl);
  const activeDisplayUrl = getDisplayUrl(activeTab);
  const activeTabKey = getTabKey(pane.id, activeTab.id);
  const activeAddressValue = editingUrls[activeTabKey] ?? activeDisplayUrl;

  return (
    <article
      className={`terminal-pane accent-${index % 4} ${isFocused ? "pane-focused" : ""} ${
        dragOverPaneId === pane.id ? "pane-drop-target" : ""
      }`}
      key={pane.id}
      data-pane-id={pane.id}
    >
      <nav
        className="tab-strip"
        aria-label={`Tab của ${pane.title}`}
        onPointerDown={(event) => {
          if (focusedPaneId || event.button !== 0 || isPaneDragControl(event.target)) {
            return;
          }

          paneDrag.current = {
            paneId: pane.id,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            active: false,
          };
          // do NOT setPointerCapture immediately — capture only when actual drag starts
        }}
        onPointerMove={(event: ReactPointerEvent<HTMLElement>) => {
          const activeDrag = paneDrag.current;

          if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
            return;
          }

          const distance = Math.hypot(
            event.clientX - activeDrag.startX,
            event.clientY - activeDrag.startY,
          );

          if (!activeDrag.active && distance < 8) {
            return;
          }

          if (!activeDrag.active) {
            activeDrag.active = true;
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // ignore — capture may not be available in some browsers
            }
          }
          setDraggingPaneId(activeDrag.paneId);

          const target = document
            .elementFromPoint(event.clientX, event.clientY)
            ?.closest<HTMLElement>("[data-pane-id]");
          const targetPaneId = target?.dataset.paneId;
          setDragOverPaneId(
            targetPaneId && targetPaneId !== activeDrag.paneId ? targetPaneId : null,
          );
        }}
        onPointerUp={(event) => finishPaneDrag(event.clientX, event.clientY)}
        onPointerCancel={() => {
          paneDrag.current = null;
          setDraggingPaneId(null);
          setDragOverPaneId(null);
        }}
      >
        <div className="tab-list">
          {pane.tabs.map((tab) => {
            const tabTitle = getTabTitle(tab);
            const tabKey = `${pane.id}:${tab.id}`;
            const isDragging = draggingTabKey === tabKey;
            const isDropBefore =
              tabDragOver?.paneId === pane.id &&
              tabDragOver?.tabId === tab.id &&
              tabDragOver?.before === true;
            const isDropAfter =
              tabDragOver?.paneId === pane.id &&
              tabDragOver?.tabId === tab.id &&
              tabDragOver?.before === false;

            return (
              <button
                className={
                  (tab.id === pane.activeTabId ? "tab active" : "tab") +
                  (isDragging ? " tab-dragging" : "") +
                  (isDropBefore ? " tab-drop-before" : "") +
                  (isDropAfter ? " tab-drop-after" : "")
                }
                key={tab.id}
                title={tabTitle}
                draggable={false}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  // ignore pointerdown on the close button so it can fire its own click
                  if ((event.target as HTMLElement).closest(".tab-close")) return;
                  event.stopPropagation(); // don't trigger pane drag
                  tabDrag.current = {
                    paneId: pane.id,
                    tabId: tab.id,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    active: false,
                  };
                }}
                onPointerMove={(event) => {
                  const drag = tabDrag.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;

                  const distance = Math.hypot(
                    event.clientX - drag.startX,
                    event.clientY - drag.startY,
                  );
                  if (!drag.active && distance < 6) return;

                  if (!drag.active) {
                    drag.active = true;
                    setDraggingTabKey(`${pane.id}:${tab.id}`);
                    try {
                      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
                    } catch {
                      // ignore
                    }
                  }

                  // Find what we're hovering over.
                  const elementUnderCursor = document.elementFromPoint(
                    event.clientX,
                    event.clientY,
                  );
                  const tabUnder = elementUnderCursor?.closest<HTMLElement>("[data-tab-id]");
                  const paneUnder = elementUnderCursor?.closest<HTMLElement>("[data-pane-id]");

                  if (tabUnder) {
                    const overTabId = tabUnder.dataset.tabId!;
                    const overPaneId = tabUnder.dataset.paneId!;
                    // intra-pane → always allow; cross-pane → only same profile
                    const sourcePane = activePanes.find((p) => p.id === drag.paneId);
                    const overPane = activePanes.find((p) => p.id === overPaneId);
                    if (
                      overPaneId === drag.paneId ||
                      (sourcePane &&
                        overPane &&
                        sourcePane.profileId === overPane.profileId &&
                        sourcePane.tabs.length > 1)
                    ) {
                      const rect = tabUnder.getBoundingClientRect();
                      const before = event.clientX < rect.left + rect.width / 2;
                      setTabDragOver({ paneId: overPaneId, tabId: overTabId, before });
                      return;
                    }
                  }

                  // hovering on a tab-list area (no specific tab) of another pane
                  const tabListUnder = elementUnderCursor?.closest<HTMLElement>(".tab-list");
                  if (
                    tabListUnder &&
                    paneUnder &&
                    paneUnder.dataset.paneId !== drag.paneId
                  ) {
                    const overPaneId = paneUnder.dataset.paneId!;
                    const sourcePane = activePanes.find((p) => p.id === drag.paneId);
                    const overPane = activePanes.find((p) => p.id === overPaneId);
                    if (
                      sourcePane &&
                      overPane &&
                      sourcePane.profileId === overPane.profileId &&
                      sourcePane.tabs.length > 1
                    ) {
                      setTabDragOver({ paneId: overPaneId, tabId: null, before: false });
                      return;
                    }
                  }

                  setTabDragOver(null);
                }}
                onPointerUp={(event) => {
                  const drag = tabDrag.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  try {
                    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
                  } catch {
                    // ignore
                  }

                  const wasActive = drag.active;
                  const overlay = tabDragOver;
                  tabDrag.current = null;
                  setDraggingTabKey(null);
                  setTabDragOver(null);

                  if (!wasActive) {
                    // simple click → switch active tab
                    updateActivePane(pane.id, (current) => ({
                      ...current,
                      activeTabId: tab.id,
                    }));
                    return;
                  }

                  // Drop logic
                  if (overlay) {
                    if (overlay.tabId) {
                      if (overlay.paneId === drag.paneId) {
                        moveTabWithinPane(
                          drag.paneId,
                          drag.tabId,
                          overlay.tabId,
                          overlay.before,
                        );
                      } else {
                        moveTabAcrossPanes(
                          drag.paneId,
                          drag.tabId,
                          overlay.paneId,
                          overlay.tabId,
                          overlay.before,
                        );
                      }
                    } else {
                      // dropped onto empty tab-list area of another pane
                      moveTabAcrossPanes(
                        drag.paneId,
                        drag.tabId,
                        overlay.paneId,
                        null,
                        false,
                      );
                    }
                    return;
                  }

                  // Dropped outside any tab → tear out
                  const elementUnderCursor = document.elementFromPoint(
                    event.clientX,
                    event.clientY,
                  );
                  const droppedOnTabStrip = !!elementUnderCursor?.closest(".tab-strip");
                  if (!droppedOnTabStrip) {
                    detachTabToNewPane(drag.paneId, drag.tabId);
                  }
                }}
                onPointerCancel={() => {
                  tabDrag.current = null;
                  setDraggingTabKey(null);
                  setTabDragOver(null);
                }}
                data-tab-id={tab.id}
                data-pane-id={pane.id}
              >
                {tab.isLoading ? (
                  <span className="tab-spinner" aria-hidden="true" />
                ) : tab.faviconUrl ? (
                  <img
                    className="tab-favicon"
                    src={tab.faviconUrl}
                    alt=""
                    draggable={false}
                  />
                ) : null}
                <span className="tab-label">{tabTitle}</span>
                <span
                  className="tab-close"
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeTab(pane.id, tab.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.stopPropagation();
                      removeTab(pane.id, tab.id);
                    }
                  }}
                  aria-label={`Xóa ${tabTitle}`}
                >
                  <IconX size={11} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="tab-actions" aria-label="Điều khiển split chat">
          <button
            className="icon-button"
            onClick={() => addTab(pane.id)}
            aria-label="Thêm tab"
          >
            <IconPlus size={13} />
          </button>
          <button
            className="icon-button"
            onClick={() => setFocusedPaneId(isFocused ? null : pane.id)}
            aria-label={isFocused ? "Thu nhỏ pane" : "Phóng to pane"}
            title={isFocused ? "Thu nhỏ" : "Phóng to"}
          >
            {isFocused ? <IconMinimize size={13} /> : <IconMaximize size={13} />}
          </button>
          <button
            className="icon-button danger"
            onClick={() => removePane(pane.id)}
            aria-label="Đóng split chat"
          >
            <IconX size={13} />
          </button>
        </div>
      </nav>

      <section className="terminal-view">
        <div className="terminal-meta">
          <div className="browser-controls" aria-label="Điều hướng web">
            <button
              type="button"
              onClick={() => navigateActiveWebview(pane.id, activeTab, "back")}
              aria-label="Lùi"
            >
              <IconArrowLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => navigateActiveWebview(pane.id, activeTab, "forward")}
              aria-label="Tiến"
            >
              <IconArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => navigateActiveWebview(pane.id, activeTab, "reload")}
              aria-label="Tải lại"
            >
              <IconRefresh size={12} />
            </button>
          </div>
          <div className="url-bar">
            {paneProfile && (
              <span className="profile-chip" title={`Profile: ${paneProfile.name}`}>
                @{paneProfile.name}
              </span>
            )}
            <input
              className="url-input"
              value={activeAddressValue}
              onChange={(event) => updateEditingUrl(pane.id, activeTab.id, event.target.value)}
              onFocus={() => startEditingUrl(pane.id, activeTab)}
              onBlur={() => commitTabUrl(pane.id, activeTab.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }

                if (event.key === "Escape") {
                  setEditingUrls((current) => {
                    const next = { ...current };
                    delete next[activeTabKey];
                    return next;
                  });
                  event.currentTarget.blur();
                }
              }}
              aria-label="URL"
            />
          </div>
          <span className="running">
            <span className={activeTab.isLoading ? "live-dot loading" : "live-dot"} />{" "}
            {activeTab.isLoading ? "Loading" : "Ready"}
          </span>
        </div>
        <div
          className="webview-shell"
          ref={(element) => {
            registerShellRef(pane.id, element);
          }}
        >
          <iframe
            className="chat-frame"
            key={`${activeTab.id}-${activeUrl}`}
            src={activeUrl}
            title={`${pane.title} / ${activeTab.title}`}
            sandbox="allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts allow-downloads"
          />
          <div className="frame-fallback">
            <span className="preview-badge">Web Preview</span>
            <h2>{activeTab.title}</h2>
            <p>
              Trang web không hiển thị được trong bản xem trước. Trên app desktop (Tauri), nội dung sẽ hiển thị đầy đủ.
            </p>
            <a href={activeUrl} target="_blank" rel="noreferrer">
              Mở bằng trình duyệt
            </a>
          </div>
        </div>
      </section>
    </article>
  );
}
