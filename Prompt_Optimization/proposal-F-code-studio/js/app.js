/**
 * Code Studio - Main App
 * Full TypeScript editor with local file management
 */

let currentView = 'explorer';
let drawerOpen = false;
let activeDrawerTab = 'output';

/**
 * Initialize app
 */
function initApp() {
  setupDrawer();
  setupKeyboardShortcuts();
  loadSettings();
  
  // Load saved code theme
  const savedTheme = localStorage.getItem('codeStudioTheme') || 'quiet-light';
  switchCodeTheme(savedTheme);
  const themeSelect = document.getElementById('code-theme-select');
  if (themeSelect) themeSelect.value = savedTheme;
}

/**
 * Switch code editor theme
 */
function switchCodeTheme(theme) {
  document.body.setAttribute('data-code-theme', theme);
  localStorage.setItem('codeStudioTheme', theme);
  
  // Sync with Monaco
  if (window.monaco && window.monacoEditor) {
    const monacoThemeMap = {
      'quiet-light': 'quiet-light',
      'dracula': 'dracula',
      'matcha': 'matcha'
    };
    monaco.editor.setTheme(monacoThemeMap[theme] || 'quiet-light');
  }
  
  console.log('Code theme switched to:', theme);
}

/**
 * Switch sidebar view (Explorer, Versions, Tests, Settings)
 */
function switchView(view) {
  currentView = view;

  // Update activity bar
  document.querySelectorAll('.activity-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });

  // Update sidebar sections
  document.querySelectorAll('.sidebar-section').forEach(section => {
    section.classList.toggle('hidden', section.dataset.section !== view);
  });
}

/**
 * Setup output drawer
 */
function setupDrawer() {
  const backdrop = document.getElementById('drawer-backdrop');
  const closeBtn = document.getElementById('close-drawer');

  backdrop?.addEventListener('click', closeDrawer);
  closeBtn?.addEventListener('click', closeDrawer);

  // Drawer tabs
  document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      switchDrawerTab(tab.dataset.tab);
    });
  });
}

/**
 * Open drawer
 */
function openDrawer() {
  drawerOpen = true;
  document.getElementById('output-drawer')?.classList.add('open');
  document.getElementById('drawer-backdrop')?.classList.add('visible');
}

/**
 * Close drawer
 */
function closeDrawer() {
  drawerOpen = false;
  document.getElementById('output-drawer')?.classList.remove('open');
  document.getElementById('drawer-backdrop')?.classList.remove('visible');
}

/**
 * Toggle drawer
 */
function toggleDrawer() {
  drawerOpen ? closeDrawer() : openDrawer();
}

/**
 * Switch drawer tab
 */
function switchDrawerTab(tab) {
  activeDrawerTab = tab;

  document.querySelectorAll('.drawer-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  document.querySelectorAll('.drawer-panel').forEach(p => {
    p.classList.toggle('hidden', p.dataset.panel !== tab);
  });
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // ESC to close drawer
    if (e.key === 'Escape' && drawerOpen) {
      closeDrawer();
    }

    // Ctrl/Cmd + Enter to run
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      runWorkflow();
    }

    // Ctrl/Cmd + S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveFile();
    }

    // Ctrl/Cmd + Shift + S to save version
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      saveVersion();
    }
  });
}

/**
 * Run workflow
 */
function runWorkflow() {
  console.log('Running workflow...');
  openDrawer();
  switchDrawerTab('logs');
  addLogEntry('info', 'Starting workflow execution...');

  // Simulate execution
  setTimeout(() => addLogEntry('info', 'Loading workflow configuration...'), 300);
  setTimeout(() => addLogEntry('debug', 'Parsed 4 workflow steps'), 600);
  setTimeout(() => addLogEntry('info', 'Step 1: Uploading video to Gemini...'), 900);
  setTimeout(() => addLogEntry('success', 'Video uploaded successfully'), 2000);
  setTimeout(() => addLogEntry('info', 'Step 2: Running analysis...'), 2100);
  setTimeout(() => addLogEntry('debug', 'Model: gemini-2.5-flash, Temperature: 0.1'), 2200);
}

/**
 * Add log entry
 */
function addLogEntry(level, message) {
  const logsContainer = document.getElementById('logs-content');
  if (!logsContainer) return;

  const time = new Date().toLocaleTimeString('en-US', { hour12: false });

  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-level ${level}">${level.toUpperCase()}</span>
    <span class="log-message">${message}</span>
  `;

  logsContainer.appendChild(entry);
  logsContainer.scrollTop = logsContainer.scrollHeight;
}

/**
 * Save current file
 */
function saveFile() {
  console.log('Saving file...');
  // In real implementation, save to local file system
  showNotification('File saved');
}

/**
 * Save as new version
 */
function saveVersion() {
  const comment = prompt('Version comment:');
  if (comment !== null) {
    console.log('Saving version with comment:', comment);
    showNotification(`Version saved: ${comment || 'No comment'}`);
  }
}

/**
 * Show notification
 */
function showNotification(message) {
  // Simple notification - in real app would be a toast
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();

  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #1a1a2e;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.remove(), 3000);
}

/**
 * Toggle subprocess
 */
function toggleSubprocess(el) {
  const header = el.closest('.subprocess-header');
  const steps = header?.nextElementSibling;
  if (steps) {
    header.classList.toggle('collapsed');
    steps.classList.toggle('hidden');
  }
}

/**
 * Toggle step details
 */
function toggleStep(el) {
  const card = el.closest('.step-card');
  card?.classList.toggle('expanded');
}

/**
 * Select video for bulk testing (called from editor.js toggleVideoSelection)
 */
function selectVideo(el) {
  el.classList.toggle('selected');
  updateBulkCount();
}

/**
 * Update bulk selection count
 */
function updateBulkCount() {
  const count = document.querySelectorAll('.test-video-item.selected').length;
  const el = document.getElementById('selected-count');
  if (el) el.textContent = `${count} selected`;
}

/**
 * Run bulk tests
 */
function runBulkTests() {
  const selected = document.querySelectorAll('.test-video-item.selected').length;
  if (selected === 0) {
    showNotification('Please select at least one video');
    return;
  }

  console.log(`Running bulk tests on ${selected} videos...`);
  openDrawer();
  switchDrawerTab('logs');
  addLogEntry('info', `Starting bulk test on ${selected} videos...`);

  // Simulate running tests
  setTimeout(() => addLogEntry('info', 'Processing video 1/3: login-flow.mp4'), 500);
  setTimeout(() => addLogEntry('debug', 'Uploading to Gemini...'), 1000);
  setTimeout(() => addLogEntry('success', 'Video 1 complete: 12 steps detected'), 3000);
}

/**
 * Compare versions
 */
function compareVersions() {
  switchDrawerTab('diff');
  openDrawer();
}

/**
 * Save settings to localStorage
 */
function saveSettings() {
  const settings = {
    apiKey: document.getElementById('api-key')?.value || '',
    model: document.getElementById('default-model')?.value || 'gemini-2.5-flash',
    temperature: parseFloat(document.getElementById('temperature')?.value) || 0.1,
    maxRetries: parseInt(document.getElementById('max-retries')?.value) || 3,
    timeout: parseInt(document.getElementById('timeout')?.value) || 120000
  };

  localStorage.setItem('codeStudioSettings', JSON.stringify(settings));

  // Expose settings globally for config.ts to read
  window.__IDE_SETTINGS__ = settings;

  showNotification('Settings saved');
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
  const saved = localStorage.getItem('codeStudioSettings');
  if (!saved) return;

  try {
    const settings = JSON.parse(saved);

    const apiKeyEl = document.getElementById('api-key');
    const modelEl = document.getElementById('default-model');
    const tempEl = document.getElementById('temperature');
    const retriesEl = document.getElementById('max-retries');
    const timeoutEl = document.getElementById('timeout');

    if (apiKeyEl) apiKeyEl.value = settings.apiKey || '';
    if (modelEl) modelEl.value = settings.model || 'gemini-2.5-flash';
    if (tempEl) tempEl.value = settings.temperature || 0.1;
    if (retriesEl) retriesEl.value = settings.maxRetries || 3;
    if (timeoutEl) timeoutEl.value = settings.timeout || 120000;

    // Expose settings globally for config.ts to read
    window.__IDE_SETTINGS__ = settings;
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', initApp);

// Export
if (typeof window !== 'undefined') {
  window.app = {
    switchView,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    runWorkflow,
    saveFile,
    saveVersion,
    toggleSubprocess,
    toggleStep,
    selectVideo,
    runBulkTests,
    compareVersions,
    saveSettings,
    switchCodeTheme
  };
  window.saveSettings = saveSettings;
}
