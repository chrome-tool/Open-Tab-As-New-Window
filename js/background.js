class Win2Pop {
  constructor() {
    this.map = new Map();

    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.map.delete(tabId);
    });

    chrome.action.onClicked.addListener((tab) => {
      chrome.windows.get(tab.windowId, (window) => {
        this.tab2Win(tab, window);
      });
    });

    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: "toggle_window",
        title: "Toggle Open As Window",
        type: "normal",
        contexts: ["all"],
      });
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        this.execute(tabs[0]);
      });
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

    if (window && window.state === "normal") {
      data.top = window.top;
      data.left = window.left;
      data.width = window.width;
      data.height = window.height;
    }

    chrome.windows.create(data);
  }

  win2Tab(tab, popupWindow) {
    const windowId = this.map.get(tab.id);
    if (windowId) {
      chrome.windows.get(windowId, (w) => {
        if (!chrome.runtime.lastError) {
          this.tnwt(tab, windowId);
        } else {
          this.tnwlf(tab, popupWindow);
        }
      });
    } else {
      this.tnwlf(tab, popupWindow);
    }
  }

  tnwlf(tab, popupWindow) {
    chrome.windows.getLastFocused({ windowTypes: ["normal"] }, (window) => {
      if (!chrome.runtime.lastError) {
        this.tnwt(tab, window.id);
      } else {
        this.tnwc(tab, popupWindow);
      }
    });
  }

  tnwc(tab, popupWindow) {
    chrome.windows.create({
      type: "normal",
      state: popupWindow.state,
      tabId: tab.id,
    });
  }

  tnwt(tab, windowId) {
    chrome.tabs.query({ windowId: windowId, active: true }, (tabs) => {
      chrome.tabs.move(
        tab.id,
        { windowId: windowId, index: tabs[0].index + 1 },
        () => {
          if (tab) {
            chrome.tabs.update(tab.id, { active: true });
          }
          chrome.windows.update(windowId, { focused: true });
        }
      );
      this.map.delete(tab.id);
    });
  }
}

new Win2Pop();
