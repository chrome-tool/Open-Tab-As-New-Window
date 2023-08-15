chrome.action.onClicked.addListener((tab) => {
	chrome.windows.create({ tabId: tab.id, type: "popup" });
});
