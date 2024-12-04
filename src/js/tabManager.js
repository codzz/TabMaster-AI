// Tab management functions
export async function getTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.map(tab => ({
    URL: tab.url,
    Title: tab.title
  }));
}

export async function groupAndSetTitle(tabIds, title) {
  return new Promise((resolve, reject) => {
    chrome.tabs.group({ tabIds }, groupId => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        chrome.tabGroups.update(groupId, { title }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            console.log(`Created group: ${title}`);
            resolve();
          }
        });
      }
    });
  });
}

export function normalizeHostname(hostname) {
  return hostname.replace(/^www\./, '');
}