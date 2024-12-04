// Background script for tab tracking and analytics

// Logger utility for consistent logging
const Logger = {
  info: (message, data) => {
    if (data) {
      console.log(`[TabMaster] ${message}`, data);
    } else {
      console.log(`[TabMaster] ${message}`);
    }
  },
  error: (message, error) => {
    console.error(`[TabMaster] ${message}`, error);
  }
};

// Initialize background script
Logger.info('Background script initialized');

// Store the last active tab and its activation time
let lastActiveTabId = null;
let lastActivationTime = null;

// Load timing data from storage
async function loadTabTimings() {
  try {
    const data = await chrome.storage.local.get('tabTimings');
    return data.tabTimings || {};
  } catch (error) {
    Logger.error('Error loading timing data', error);
    return {};
  }
}

// Save timing data to storage
async function saveTabTimings(timings) {
  try {
    await chrome.storage.local.set({ tabTimings: timings });
    Logger.info('Saved timing data');
  } catch (error) {
    Logger.error('Error saving timing data', error);
  }
}

// Update timing for a tab
async function updateTabTiming(tabId, groupId) {
  try {
    const now = Date.now();
    const timings = await loadTabTimings();

    // Update time for the previously active tab
    if (lastActiveTabId && lastActivationTime) {
      const duration = now - lastActivationTime;
      if (!timings[lastActiveTabId]) {
        timings[lastActiveTabId] = {
          totalTime: 0,
          lastActiveTime: now,
          groupId: null
        };
      }
      timings[lastActiveTabId].totalTime += duration;
      timings[lastActiveTabId].lastActiveTime = now;
    }

    // Initialize timing for the new active tab
    if (!timings[tabId]) {
      timings[tabId] = {
        totalTime: 0,
        lastActiveTime: now,
        groupId: groupId
      };
    }

    // Update group ID if provided
    if (groupId !== undefined) {
      timings[tabId].groupId = groupId;
    }

    // Save updated timings
    await saveTabTimings(timings);

    // Update last active tab info
    lastActiveTabId = tabId;
    lastActivationTime = now;
  } catch (error) {
    Logger.error('Error updating tab timing', error);
  }
}

// Clean up old tab data (older than 30 days)
async function cleanupOldData() {
  try {
    const timings = await loadTabTimings();
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Remove entries older than 30 days
    let hasChanges = false;
    for (const [tabId, timing] of Object.entries(timings)) {
      if (timing.lastActiveTime < thirtyDaysAgo) {
        delete timings[tabId];
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await saveTabTimings(timings);
      Logger.info('Cleaned up old timing data');
    }
  } catch (error) {
    Logger.error('Error cleaning up old data', error);
  }
}

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await updateTabTiming(activeInfo.tabId.toString(), tab.groupId);
    Logger.info('Tab activated:', tab.url);
  } catch (error) {
    Logger.error('Error handling tab activation:', error);
  }
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    await updateTabTiming(tabId.toString(), tab.groupId);
    Logger.info('Tab updated:', tabId);
  }
});

// Listen for tab group changes
chrome.tabGroups.onUpdated.addListener(async (group) => {
  try {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    for (const tab of tabs) {
      await updateTabTiming(tab.id.toString(), group.id);
    }
    Logger.info('Tab group updated:', group);
  } catch (error) {
    Logger.error('Error handling group update:', error);
  }
});

// Handle tab removal
chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (lastActiveTabId === tabId.toString()) {
    lastActiveTabId = null;
    lastActivationTime = null;
  }
  Logger.info('Tab removed:', tabId);
});

// Clean up old data periodically (every hour)
setInterval(cleanupOldData, 60 * 60 * 1000);

// Initial cleanup
cleanupOldData();
