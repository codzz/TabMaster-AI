// Import required modules
import { Logger } from './logger.js';

// Initialize state
let lastActiveTabId = null;
let lastActivationTime = null;
let tabTimings = new Map();

// Load existing timing data
async function loadTabTimings() {
  try {
    const data = await chrome.storage.local.get('tabTimings');
    if (data.tabTimings) {
      tabTimings = new Map(Object.entries(data.tabTimings));
      Logger.info('Loaded timing data', data.tabTimings);
    }
  } catch (error) {
    Logger.error('Error loading timing data:', error);
  }
}

// Save timing data to storage
async function saveTabTimings() {
  try {
    const timingsObj = Object.fromEntries(tabTimings);
    await chrome.storage.local.set({ tabTimings: timingsObj });
    Logger.info('Saved timing data', timingsObj);
  } catch (error) {
    Logger.error('Error saving timing data:', error);
  }
}

// Update timing for the previously active tab
async function updatePreviousTabTiming() {
  if (lastActiveTabId && lastActivationTime) {
    const currentTime = Date.now();
    const duration = currentTime - lastActivationTime;
    
    try {
      const tab = await chrome.tabs.get(lastActiveTabId);
      const timing = tabTimings.get(lastActiveTabId.toString()) || { usage: 0, groupId: null, lastAccessed: Date.now() };
      timing.usage += duration;
      timing.groupId = tab.groupId;
      timing.lastAccessed = Date.now();
      tabTimings.set(lastActiveTabId.toString(), timing);
      await saveTabTimings();
    } catch (error) {
      // Tab might have been closed
      Logger.error('Error updating previous tab timing:', error);
    }
  }
}

// Listen for tab activation
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await updatePreviousTabTiming();
    lastActiveTabId = activeInfo.tabId;
    lastActivationTime = Date.now();
    Logger.info('Tab activated:', activeInfo.tabId);
  } catch (error) {
    Logger.error('Error handling tab activation:', error);
  }
});

// Listen for tab group changes
chrome.tabGroups.onUpdated.addListener(async (group) => {
  try {
    const tabs = await chrome.tabs.query({ groupId: group.id });
    for (const tab of tabs) {
      // Skip analytics page
      if (tab.url.includes('analytics.html')) {
        continue;
      }
      
      const timing = tabTimings.get(tab.id.toString()) || { usage: 0, groupId: null, lastAccessed: Date.now() };
      timing.groupId = group.id;
      timing.lastAccessed = Date.now();
      tabTimings.set(tab.id.toString(), timing);
    }
    await saveTabTimings();
    Logger.info('Tab group updated:', group);
  } catch (error) {
    Logger.error('Error handling group update:', error);
  }
});

// Clean up old data (older than 30 days)
async function cleanupOldData() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  for (const [tabId, timing] of tabTimings) {
    if (timing.lastAccessed < thirtyDaysAgo) {
      tabTimings.delete(tabId);
    }
  }
  await saveTabTimings();
}

// Initialize background script
loadTabTimings().then(() => {
  Logger.info('Background script initialized');
  // Run cleanup daily
  setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
});
