class Win2Pop {
  constructor() {
    this.map = new Map();

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.map.delete(tabId);
    });

    chrome.action.onClicked.addListener((tab) => {
      this.execute(tab);
    });

    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "toggle_window",
        title: "Toggle Open As Window",
        type: "normal",
        contexts: ["all", "action"],
      });
      chrome.contextMenus.create({
        id: "batch_to_window",
        title: "Move All Tabs to New Window",
        type: "normal",
        contexts: ["all", "action"],
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === "toggle_window") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          this.execute(tabs[0]);
        });
      } else if (info.menuItemId === "batch_to_window") {
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
          this.batchToWindow(tabs);
        });
      }
    });

    chrome.commands.onCommand.addListener((command) => {
      if (command === "toggle_window") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          this.execute(tabs[0]);
        });
      }
    });
  }

  execute(tab) {
    chrome.windows.get(tab.windowId, (window) => {
      if (window.type === "popup") {
        this.win2Tab(tab, window);
      } else {
        this.tab2Win(tab, window);
      }
    });
  }

  tab2Win(tab, window) {
    const data = { type: "popup" };
    if (tab) {
      data.tabId = tab.id;
      this.map.set(tab.id, window.id);
    }
    if (window) {
      data.top = window.top;
      data.left = window.left;
      data.width = window.width;
      data.height = window.height;
    }
    chrome.windows.create(data);
  }

  batchToWindow(tabs) {
    if (!tabs || tabs.length === 0) return;
    chrome.windows.getCurrent((window) => {
      const data = { type: "popup" };
      if (window) {
        data.top = window.top;
        data.left = window.left;
        data.width = window.width;
        data.height = window.height;
      }
      for (const tab of tabs) {
        chrome.windows.create({ ...data, tabId: tab.id });
      }
    });
  }

  win2Tab(tab, popupWindow) {
    const windowId = this.map.get(tab.id);
    if (windowId) {
      chrome.windows.get(windowId, () => {
        if (!chrome.runtime.lastError) {
          this.moveTabToWindow(tab, windowId);
        } else {
          this.moveToLastFocusedWindow(tab, popupWindow);
        }
      });
    } else {
      this.moveToLastFocusedWindow(tab, popupWindow);
    }
  }

  moveToLastFocusedWindow(tab, popupWindow) {
    chrome.windows.getLastFocused({ windowTypes: ["normal"] }, (window) => {
      if (!chrome.runtime.lastError) {
        this.moveTabToWindow(tab, window.id);
      } else {
        this.createNormalWindow(tab, popupWindow);
      }
    });
  }

  createNormalWindow(tab, popupWindow) {
    chrome.windows.create({
      type: "normal",
      state: popupWindow.state,
      tabId: tab.id,
    });
  }

  moveTabToWindow(tab, windowId) {
    chrome.tabs.query({ windowId: windowId, active: true }, (tabs) => {
      chrome.tabs.move(
        tab.id,
        { windowId: windowId, index: tabs[0].index + 1 },
        () => {
          if (tab) {
            chrome.tabs.update(tab.id, { active: true });
          }
          chrome.windows.update(windowId, { focused: true });
        },
      );
      this.map.delete(tab.id);
    });
  }
}

new Win2Pop();
