// The toolbar button toggles the side panel.
//
// Chrome's openPanelOnActionClick only ever opens the panel, so handle the
// click ourselves. Open panels hold a port (see lib/panel/panel.ts) named
// "panel:<windowId>", which tells us where the panel is open. Ports reconnect
// if the service worker restarts, so this survives the worker going idle.

const openPanels = new Map<number, Browser.runtime.Port>();

export function setUpToolbarToggle() {
  const sidePanel = (browser as any).sidePanel;
  const sidebarAction = (browser as any).sidebarAction;
  const action = browser.action ?? (browser as any).browserAction;

  if (sidePanel?.open) {
    sidePanel.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
    browser.runtime.onConnect.addListener((port) => {
      const windowId = Number(/^panel:(\d+)$/.exec(port.name)?.[1]);
      if (!windowId) return;
      openPanels.set(windowId, port);
      port.onDisconnect.addListener(() => {
        if (openPanels.get(windowId) === port) openPanels.delete(windowId);
      });
    });
    action.onClicked.addListener((tab: Browser.tabs.Tab) => {
      const windowId = tab.windowId;
      const port = openPanels.get(windowId);
      if (port) {
        // sidePanel.close() needs Chrome 141+; older versions get the panel to close itself.
        if (sidePanel.close) sidePanel.close({ windowId }).catch(() => port.postMessage('close'));
        else port.postMessage('close');
        return;
      }
      // Must be called synchronously inside the click: no awaits before this.
      sidePanel.open({ windowId }).catch(() => {});
    });
  } else if (sidebarAction?.toggle) {
    // Firefox.
    action.onClicked.addListener(() => sidebarAction.toggle());
  }
  // Safari has neither and shows the popup instead.
}
