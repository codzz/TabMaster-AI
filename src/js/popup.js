import { convertToJson } from './api.js';
import { getTabs, groupAndSetTitle, normalizeHostname } from './tabManager.js';
import { categorizeURLs } from './categorizer.js';
import { updateButtonState } from './ui.js';
import { Logger } from './logger.js';
import { getTabGroupsUsage, formatUsageTime } from './usageTracker.js';

async function updateGroupsList() {
  const groupsList = document.getElementById('groupsList');
  const usageData = await getTabGroupsUsage();
  
  Logger.info('Received usage data:', usageData);

  if (Object.keys(usageData).length === 0) {
    groupsList.innerHTML = `
      <div class="no-groups">
        No tab groups yet. Click "Organize Tabs" to get started!
      </div>
    `;
    return;
  }

  groupsList.innerHTML = Object.entries(usageData)
    .map(([groupId, data]) => {
      Logger.info(`Processing group ${groupId}:`, data);
      return `
        <div class="group-item" style="border-left-color: ${data.color || '#6366f1'}">
          <div class="group-info">
            <div class="group-title">${data.title}</div>
            <div class="group-stats">${data.tabCount} tab${data.tabCount !== 1 ? 's' : ''}</div>
          </div>
          <div class="group-usage">${formatUsageTime(data.usage)}</div>
        </div>
      `;
    })
    .join('');
}

async function groupTabs() {
  const button = document.getElementById('groupButton');
  const originalButtonContent = button.innerHTML;
  const performance = Logger.performance('Tab Organization Process');
  
  updateButtonState(button, 'loading');
  performance.start();

  try {
    Logger.group('Starting Tab Organization');
    Logger.info('Initializing tab organization process');

    const tabDetails = await getTabs();
    Logger.success('Retrieved tabs', { count: tabDetails.length });
    
    const tabDetailsJson = JSON.stringify(tabDetails, null, 2);
    Logger.info('Tab details prepared for categorization', tabDetails);
    
    Logger.group('AI Categorization');
    const categorizedData = await categorizeURLs(tabDetailsJson);
    Logger.success('AI categorization completed');
    Logger.groupEnd();

    Logger.group('JSON Conversion');
    //Current chrome inbuilt ai is not returning json, so converting the data using gemini api temporarily
    //I will remove below code once inbuilt ai returns json properly.
    const parsedResponse = await convertToJson(categorizedData);
    const categorizedUrls = JSON.parse(parsedResponse.jsonResult);
    Logger.success('Data conversion completed', categorizedUrls);
    Logger.groupEnd();

    const tabs = await chrome.tabs.query({ currentWindow: true });
    Logger.info('Processing tabs for grouping', { totalTabs: tabs.length });

    for (const [category, urls] of Object.entries(categorizedUrls)) {
      if (urls.length > 0) {
        Logger.group(`Processing category: ${category}`);
        const categoryTabs = tabs.filter(tab => {
          try {
            const tabUrl = new URL(tab.url);
            return urls.some(urlObj => {
              try {
                const categoryUrl = new URL(urlObj.url);
                return normalizeHostname(tabUrl.hostname) === normalizeHostname(categoryUrl.hostname);
              } catch (e) {
                Logger.error('Invalid category URL', { url: urlObj.url, error: e });
                return false;
              }
            });
          } catch (e) {
            Logger.error('Invalid tab URL', { url: tab.url, error: e });
            return false;
          }
        });

        if (categoryTabs.length > 0) {
          Logger.info(`Creating group for ${category}`, { tabCount: categoryTabs.length });
          await groupAndSetTitle(categoryTabs.map(tab => tab.id), category);
          Logger.success(`Group created: ${category}`, { tabCount: categoryTabs.length });
        } else {
          Logger.warning(`No tabs found for category: ${category}`);
        }
        Logger.groupEnd();
      }
    }

    Logger.success('Tab organization completed successfully');
    updateButtonState(button, 'success', originalButtonContent);
    
    // Update the groups list after organizing
    await updateGroupsList();
  } catch (error) {
    Logger.error('Tab organization failed', error);
    updateButtonState(button, 'error', originalButtonContent);
  } finally {
    performance.end();
    Logger.groupEnd();
  }
}

// Initialize the popup
document.addEventListener('DOMContentLoaded', () => {
  updateGroupsList();
  document.getElementById('groupButton').addEventListener('click', groupTabs);
  
  // Add analytics link click handler
  document.getElementById('analyticsLink').addEventListener('click', (event) => {
    event.preventDefault();
    chrome.windows.create({
      url: 'analytics.html',
      type: 'popup',
      width: 800,
      height: 600
    });
  });
});