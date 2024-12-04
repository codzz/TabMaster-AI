import { Logger } from './logger.js';
import { formatUsageTime } from './usageTracker.js';

// Load timing data from storage
async function loadTabTimings() {
  try {
    const data = await chrome.storage.local.get('tabTimings');
    Logger.info('Raw timing data from storage:', data);
    return data.tabTimings ? new Map(Object.entries(data.tabTimings)) : new Map();
  } catch (error) {
    Logger.error('Error loading timing data', error);
    return new Map();
  }
}

// Get weekly usage data
export async function getWeeklyUsage() {
  try {
    const tabTimings = await loadTabTimings();
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    const dailyUsage = Array(7).fill(0);
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (const [, timing] of tabTimings) {
      if (timing.lastAccessed && timing.lastAccessed > oneWeekAgo) {
        const date = new Date(timing.lastAccessed);
        const dayIndex = date.getDay();
        dailyUsage[dayIndex] += timing.usage || 0;
      }
    }
    
    Logger.info('Weekly usage data:', { dailyUsage });
    
    return {
      labels: daysOfWeek,
      data: dailyUsage.map(time => Math.round(time / (1000 * 60))), // Convert to minutes
    };
  } catch (error) {
    Logger.error('Error getting weekly usage', error);
    return { labels: [], data: [] };
  }
}

// Get monthly usage data
export async function getMonthlyUsage() {
  try {
    const tabTimings = await loadTabTimings();
    const now = Date.now();
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    const monthlyUsage = Array(30).fill(0);
    
    for (const [, timing] of tabTimings) {
      if (timing.lastAccessed && timing.lastAccessed > oneMonthAgo) {
        const daysAgo = Math.floor((now - timing.lastAccessed) / (24 * 60 * 60 * 1000));
        if (daysAgo < 30) {
          monthlyUsage[daysAgo] += timing.usage || 0;
        }
      }
    }
    
    Logger.info('Monthly usage data:', { monthlyUsage });
    
    return {
      labels: monthlyUsage.map((_, i) => `Day ${30 - i}`),
      data: monthlyUsage.map(time => Math.round(time / (1000 * 60))).reverse(),
    };
  } catch (error) {
    Logger.error('Error getting monthly usage', error);
    return { labels: [], data: [] };
  }
}

// Get peak productivity hours
export async function getPeakHours() {
  try {
    const tabTimings = await loadTabTimings();
    const hourlyUsage = Array(24).fill(0);
    
    for (const [, timing] of tabTimings) {
      if (timing.lastAccessed) {
        const hour = new Date(timing.lastAccessed).getHours();
        hourlyUsage[hour] += timing.usage || 0;
      }
    }
    
    Logger.info('Hourly usage data:', { hourlyUsage });
    
    return {
      labels: hourlyUsage.map((_, i) => `${i}:00`),
      data: hourlyUsage.map(time => Math.round(time / (1000 * 60))), // Convert to minutes
    };
  } catch (error) {
    Logger.error('Error getting peak hours', error);
    return { labels: [], data: [] };
  }
}

// Get most visited sites per group
export async function getMostVisitedSites() {
  try {
    const tabTimings = await loadTabTimings();
    const groupedSites = new Map();
    
    // Get current tabs to map IDs to URLs
    const tabs = await chrome.tabs.query({});
    const tabMap = new Map(tabs.map(tab => [tab.id, tab]));
    
    // Process tab timings
    for (const [tabId, timing] of tabTimings) {
      const tab = tabMap.get(parseInt(tabId));
      if (tab) {
        let groupKey = 'Ungrouped';
        
        if (timing.groupId) {
          try {
            const group = await chrome.tabGroups.get(timing.groupId);
            if (group && group.title) {
              groupKey = group.title;
            }
          } catch (error) {
            Logger.info('Tab group not found, using Ungrouped', { groupId: timing.groupId });
          }
        }
        
        if (!groupedSites.has(groupKey)) {
          groupedSites.set(groupKey, new Map());
        }
        
        const groupSites = groupedSites.get(groupKey);
        try {
          const hostname = new URL(tab.url).hostname;
          const currentUsage = groupSites.get(hostname) || 0;
          groupSites.set(hostname, currentUsage + (timing.usage || 0));
        } catch (error) {
          Logger.error('Invalid URL', { url: tab.url, error });
        }
      }
    }
    
    // Convert to array and sort
    const result = {};
    for (const [groupTitle, sites] of groupedSites) {
      const sortedSites = Array.from(sites.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5) // Top 5 sites
        .map(([hostname, time]) => ({
          hostname,
          time: formatUsageTime(time)
        }));
      
      if (sortedSites.length > 0) {  // Only include groups that have sites
        result[groupTitle] = sortedSites;
      }
    }
    
    Logger.info('Most visited sites data:', result);
    return result;
  } catch (error) {
    Logger.error('Error getting most visited sites', error);
    return {};
  }
}

// Export data to CSV
export async function exportToCSV() {
  try {
    const weeklyData = await getWeeklyUsage();
    const monthlyData = await getMonthlyUsage();
    const peakHours = await getPeakHours();
    const mostVisited = await getMostVisitedSites();
    
    let csv = 'Weekly Usage (minutes)\n';
    csv += weeklyData.labels.join(',') + '\n';
    csv += weeklyData.data.join(',') + '\n\n';
    
    csv += 'Monthly Usage (minutes)\n';
    csv += monthlyData.labels.join(',') + '\n';
    csv += monthlyData.data.join(',') + '\n\n';
    
    csv += 'Peak Hours (minutes)\n';
    csv += peakHours.labels.join(',') + '\n';
    csv += peakHours.data.join(',') + '\n\n';
    
    csv += 'Most Visited Sites by Group\n';
    for (const [group, sites] of Object.entries(mostVisited)) {
      csv += `\n${group}\n`;
      csv += 'Site,Usage Time\n';
      sites.forEach(site => {
        csv += `${site.hostname},${site.time}\n`;
      });
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tab-analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    Logger.error('Error exporting data', error);
    throw error;
  }
}
