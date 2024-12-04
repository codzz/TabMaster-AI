import { Logger } from './logger.js';

// Initialize state
let tabTimings = new Map();

// Load timing data from storage
export async function loadTabTimings() {
  try {
    const data = await chrome.storage.local.get('tabTimings');
    Logger.info('Raw storage data:', data);
    
    if (data.tabTimings) {
      // Convert stored object to Map and validate data
      const entries = Object.entries(data.tabTimings);
      Logger.info('Loading timing entries:', entries);
      
      tabTimings = new Map(
        entries.map(([tabId, timing]) => {
          // Ensure usage is a valid number
          if (timing && typeof timing.usage !== 'number') {
            timing.usage = parseInt(timing.usage) || 0;
          }
          return [tabId, timing];
        })
      );
      
      Logger.info('Loaded timing data:', Object.fromEntries(tabTimings));
    } else {
      Logger.info('No existing timing data found');
      tabTimings = new Map();
    }
  } catch (error) {
    Logger.error('Error loading timing data:', error);
    tabTimings = new Map();
  }
}

// Save timing data to storage
export async function saveTabTimings() {
  try {
    const timingsObj = Object.fromEntries(tabTimings);
    Logger.info('Saving timing data:', timingsObj);
    await chrome.storage.local.set({ tabTimings: timingsObj });
  } catch (error) {
    Logger.error('Error saving timing data:', error);
  }
}

// Format usage time for display
export function formatUsageTime(milliseconds) {
  // Handle invalid inputs
  if (milliseconds === undefined || milliseconds === null) {
    Logger.error('Invalid usage time value:', milliseconds);
    return '0m';
  }

  // Ensure milliseconds is a number
  const ms = Number(milliseconds);
  if (isNaN(ms) || ms < 0) {
    Logger.error('Invalid usage time format:', milliseconds);
    return '0m';
  }
  
  const minutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

// Get total usage time for each tab group
export async function getTabGroupsUsage() {
  try {
    await loadTabTimings();
    const groupUsage = {};
    
    // Get current tab groups and tabs
    const [tabs, groups] = await Promise.all([
      chrome.tabs.query({}),
      chrome.tabGroups.query({})
    ]);
    
    Logger.info('Current tabs:', tabs);
    Logger.info('Current groups:', groups);
    
    // Initialize group usage with current groups
    for (const group of groups) {
      groupUsage[group.id] = {
        title: group.title || 'Unnamed Group',
        color: group.color || '#6366f1',
        usage: 0,
        tabCount: 0,
        lastUpdated: Date.now()
      };
    }
    
    // Update current active tab timing first
    const activeTab = tabs.find(tab => tab.active);
    if (activeTab) {
      Logger.info('Updating active tab:', activeTab);
      await updateActiveTabTiming(activeTab.id);
    }
    
    // Calculate tab counts and accumulate usage time
    for (const tab of tabs) {
      if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE && groupUsage[tab.groupId]) {
        groupUsage[tab.groupId].tabCount++;
        
        const timing = tabTimings.get(tab.id.toString());
        Logger.info(`Tab ${tab.id} timing:`, timing);
        
        if (timing && typeof timing.usage === 'number') {
          groupUsage[tab.groupId].usage += timing.usage;
          Logger.info(`Added ${timing.usage}ms to group ${tab.groupId}. New total: ${groupUsage[tab.groupId].usage}ms`);
        }
      }
    }
    
    Logger.info('Final group usage data:', groupUsage);
    return groupUsage;
  } catch (error) {
    Logger.error('Error getting group usage:', error);
    return {};
  }
}

// Update timing for the currently active tab
async function updateActiveTabTiming(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) return;

    const currentTime = Date.now();
    const timing = tabTimings.get(tabId.toString());
    
    if (timing && timing.lastActivationTime) {
      const duration = currentTime - timing.lastActivationTime;
      timing.usage = (timing.usage || 0) + duration;
      timing.lastAccessed = currentTime;
      timing.lastActivationTime = currentTime;
      Logger.info(`Updated tab ${tabId} timing:`, timing);
    } else {
      // Initialize new timing entry
      tabTimings.set(tabId.toString(), {
        usage: 0,
        groupId: tab.groupId,
        lastAccessed: currentTime,
        lastActivationTime: currentTime
      });
      Logger.info(`Initialized new timing for tab ${tabId}`);
    }
    
    await saveTabTimings();
  } catch (error) {
    Logger.error('Error updating active tab timing:', error);
  }
}

// Initialize timing tracking
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    Logger.info('Tab activated:', activeInfo);
    await updateActiveTabTiming(activeInfo.tabId);
  } catch (error) {
    Logger.error('Error handling tab activation:', error);
  }
});

// Track tab group changes
chrome.tabGroups.onUpdated.addListener(async (group) => {
  try {
    Logger.info('Group updated:', group);
    const tabs = await chrome.tabs.query({ groupId: group.id });
    for (const tab of tabs) {
      const timing = tabTimings.get(tab.id.toString()) || {
        usage: 0,
        groupId: group.id,
        lastAccessed: Date.now(),
        lastActivationTime: Date.now()
      };
      timing.groupId = group.id;
      tabTimings.set(tab.id.toString(), timing);
    }
    await saveTabTimings();
  } catch (error) {
    Logger.error('Error handling group update:', error);
  }
});

// Load initial timing data
loadTabTimings();
