import { getWeeklyUsage, getMonthlyUsage, getPeakHours, getMostVisitedSites, exportToCSV } from './analytics.js';
import { Logger } from './logger.js';

let usageChart = null;
let peakHoursChart = null;

// Show error message to user
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="20" height="20">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
    </svg>
    ${message}
  `;
  
  // Remove any existing error messages
  const existingError = document.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }
  
  // Insert at the top of the page
  const container = document.querySelector('.analytics-page');
  container.insertBefore(errorDiv, container.firstChild);
  
  // Auto-remove after 5 seconds
  setTimeout(() => errorDiv.remove(), 5000);
}

// Initialize charts
async function initCharts() {
  try {
    Logger.info('Initializing charts...');
    const weeklyData = await getWeeklyUsage();
    const peakHoursData = await getPeakHours();
    
    Logger.info('Weekly data:', weeklyData);
    Logger.info('Peak hours data:', peakHoursData);
    
    // Usage chart
    const usageCtx = document.getElementById('usageChart').getContext('2d');
    usageChart = new Chart(usageCtx, {
      type: 'bar',
      data: {
        labels: weeklyData.labels,
        datasets: [{
          label: 'Usage (minutes)',
          data: weeklyData.data,
          backgroundColor: '#6366f1',
          borderColor: '#4f46e5',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Weekly Tab Usage'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Minutes'
            }
          }
        }
      }
    });

    // Peak hours chart
    const peakHoursCtx = document.getElementById('peakHoursChart').getContext('2d');
    peakHoursChart = new Chart(peakHoursCtx, {
      type: 'line',
      data: {
        labels: peakHoursData.labels,
        datasets: [{
          label: 'Usage (minutes)',
          data: peakHoursData.data,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Usage by Hour'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Minutes'
            }
          }
        }
      }
    });

    // Update most visited sites
    await updateMostVisitedSites();
    
    // Set up periodic refresh
    setInterval(refreshData, 60000); // Refresh every minute
    
    Logger.success('Charts initialized successfully');
  } catch (error) {
    Logger.error('Error initializing charts:', error);
    showError('Failed to load analytics data. Please try refreshing the page.');
  }
}

// Update usage chart with new data
async function updateUsageChart(period) {
  try {
    Logger.info(`Updating usage chart for period: ${period}`);
    const data = period === 'weekly' ? await getWeeklyUsage() : await getMonthlyUsage();
    
    Logger.info('New chart data:', data);
    
    usageChart.data.labels = data.labels;
    usageChart.data.datasets[0].data = data.data;
    usageChart.options.plugins.title.text = `${period === 'weekly' ? 'Weekly' : 'Monthly'} Tab Usage`;
    usageChart.update();
    
    Logger.success('Usage chart updated successfully');
  } catch (error) {
    Logger.error('Error updating usage chart:', error);
    showError('Failed to update usage data.');
  }
}

// Update most visited sites list
async function updateMostVisitedSites() {
  try {
    Logger.info('Updating most visited sites...');
    const mostVisitedData = await getMostVisitedSites();
    const container = document.getElementById('mostVisitedList');
    
    Logger.info('Most visited data:', mostVisitedData);
    
    if (Object.keys(mostVisitedData).length === 0) {
      container.innerHTML = `
        <div class="no-data">
          No tab group data available yet. Start using tab groups to see analytics!
        </div>
      `;
      return;
    }
    
    container.innerHTML = Object.entries(mostVisitedData)
      .map(([group, sites]) => `
        <div class="group-sites">
          <h3>${group}</h3>
          <div class="sites-list">
            ${sites.map(site => `
              <div class="site-item">
                <div class="site-name">${site.hostname}</div>
                <div class="site-time">${site.time}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `)
      .join('');
      
    Logger.success('Most visited sites updated successfully');
  } catch (error) {
    Logger.error('Error updating most visited sites:', error);
    showError('Failed to update most visited sites.');
  }
}

// Refresh all data
async function refreshData() {
  try {
    Logger.info('Refreshing all data...');
    const activeButton = document.querySelector('.analytics-controls button.active');
    const period = activeButton.id === 'weeklyBtn' ? 'weekly' : 'monthly';
    
    await updateUsageChart(period);
    await updateMostVisitedSites();
    
    // Update peak hours
    const peakHoursData = await getPeakHours();
    peakHoursChart.data.labels = peakHoursData.labels;
    peakHoursChart.data.datasets[0].data = peakHoursData.data;
    peakHoursChart.update();
    
    Logger.success('Data refresh completed');
  } catch (error) {
    Logger.error('Error refreshing data:', error);
    showError('Failed to refresh analytics data.');
  }
}

// Event listeners
document.getElementById('weeklyBtn').addEventListener('click', async (e) => {
  document.querySelectorAll('.analytics-controls button').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
  await updateUsageChart('weekly');
});

document.getElementById('monthlyBtn').addEventListener('click', async (e) => {
  document.querySelectorAll('.analytics-controls button').forEach(btn => btn.classList.remove('active'));
  e.target.classList.add('active');
  await updateUsageChart('monthly');
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    await exportToCSV();
    Logger.success('Data exported successfully');
  } catch (error) {
    Logger.error('Error exporting data:', error);
    showError('Failed to export data. Please try again.');
  }
});

// Initialize the page
document.addEventListener('DOMContentLoaded', initCharts);
