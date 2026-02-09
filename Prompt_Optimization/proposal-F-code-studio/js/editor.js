/**
 * Code Studio - Editor with Monaco Integration
 */

let editor;
let activeFile = 'workflow/main.ts';
let openTabs = ['workflow/main.ts', 'workflow/prompts.ts'];

// File structure (keeping original data)
const fileTree = {
  'workflow': {
    type: 'folder',
    expanded: true,
    children: {
      'main.ts': {
        type: 'file',
        language: 'typescript',
        content: `/**
 * Video Analysis Workflow - Main Entry Point
 */

import { SYSTEM_PROMPT, USER_PROMPT } from './prompts';
import { OUTPUT_SCHEMA, type Step, type ProcessResult } from './schema';
import { uploadToGemini, waitForProcessing } from './utils';
import { config } from './config';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Main analysis function
 */
export async function analyzeVideo(
  videoPath: string,
  context?: string
): Promise<ProcessResult> {
  console.log('[INFO] Starting video analysis...');

  // Step 1: Upload video using utility function
  const file = await uploadToGemini(videoPath, {
    mimeType: 'video/mp4',
    displayName: 'process-recording'
  });

  await waitForProcessing(file.name);
  console.log('[SUCCESS] Video ready:', file.uri);

  // Step 2: Configure model
  const model = genAI.getGenerativeModel({
    model: config.model,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: config.temperature,
      responseMimeType: 'application/json',
      responseSchema: OUTPUT_SCHEMA
    }
  });

  // Step 3: Run analysis
  const result = await model.generateContent([
    { fileData: { fileUri: file.uri, mimeType: 'video/mp4' } },
    { text: USER_PROMPT.replace('{{context}}', context || '') }
  ]);

  return JSON.parse(result.response.text());
}`
      },
      'prompts.ts': {
        type: 'file',
        language: 'typescript',
        modified: true,
        content: `export const SYSTEM_PROMPT = \`You are an expert RPA analyst...\`;
export const USER_PROMPT = \`Analyze this recording...\`;`
      },
      'schema.ts': {
        type: 'file',
        language: 'typescript',
        content: `export interface ProcessResult {
  processName: string;
  steps: Step[];
}

export interface Step {
  stepNumber: number;
  description: string;
  timestamp: string;
}`
      }
    }
  }
};

const testVideos = [
  { id: 'test-001', name: 'login-flow.mp4', duration: '2:34', expectedSteps: 12 },
  { id: 'test-002', name: 'form-submission.mp4', duration: '1:45', expectedSteps: 8 }
];

const versions = [
  { id: 'v3', name: 'v1.2.0', date: '2025-01-21 14:30', comment: 'Added subprocess detection', current: true },
  { id: 'v2', name: 'v1.1.0', date: '2025-01-20 16:45', comment: 'Improved UI detection', current: false }
];

/**
 * Initialize Editor (Monaco)
 */
function initEditor() {
  require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });

  require(['vs/editor/editor.main'], function() {
    // Register custom themes for Monaco
    monaco.editor.defineTheme('quiet-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'aaaaaa' },
        { token: 'keyword', foreground: '4b69c6' },
        { token: 'string', foreground: '448c27' },
        { token: 'function', foreground: '7a3e9d' },
        { token: 'number', foreground: 'ab6526' }
      ],
      colors: {
        'editor.background': '#f5f5f5',
        'editorCursor.foreground': '#333333',
        'editor.lineHighlightBackground': '#e0e0e0',
        'editorLineNumber.foreground': '#aaaaaa',
        'editor.selectionBackground': '#cce6ff'
      }
    });

    monaco.editor.defineTheme('dracula', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4' },
        { token: 'keyword', foreground: 'ff79c6' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'function', foreground: '50fa7b' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'class', foreground: '8be9fd' },
        { token: 'variable', foreground: 'f8f8f2' }
      ],
      colors: {
        'editor.background': '#282a36',
        'editor.foreground': '#f8f8f2',
        'editorCursor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#44475a',
        'editorLineNumber.foreground': '#6272a4',
        'editor.selectionBackground': '#44475a'
      }
    });

    monaco.editor.defineTheme('matcha', {
      base: 'vs',
      inherit: true,
      rules: [
         { token: 'comment', foreground: '90aca6' },
         { token: 'keyword', foreground: '6a9c6c' },
         { token: 'string', foreground: 'cfa86e' },
         { token: 'function', foreground: '82a893' },
         { token: 'number', foreground: 'cc8b65' }
      ],
      colors: {
        'editor.background': '#ecf0eb',
        'editor.foreground': '#5c6e74',
        'editorCursor.foreground': '#5c6e74',
        'editor.lineHighlightBackground': '#dbe4dd',
        'editorLineNumber.foreground': '#90aca6',
        'editor.selectionBackground': '#d4e0d9'
      }
    });

    const container = document.getElementById('monaco-container');
    container.innerHTML = ''; // Clear Initializing message

    editor = monaco.editor.create(container, {
      value: getFile(activeFile).content,
      language: 'typescript',
      theme: getMonacoTheme(localStorage.getItem('codeStudioTheme') || 'quiet-light'),
      automaticLayout: true,
      lineNumbers: 'on',
      fontSize: 13,
      fontFamily: 'JetBrains Mono',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 16, bottom: 16 }
    });

    // Handle content changes
    editor.onDidChangeModelContent(() => {
      const file = getFile(activeFile);
      if (file) {
        file.content = editor.getValue();
        file.modified = true;
        renderTabs();
        renderFileTree();
      }
      updateStats();
    });

    // Expose editor to app
    window.monacoEditor = editor;
    
    // Initial renders
    renderFileTree();
    renderTabs();
    renderVersions();
    renderTestVideos();
    updateStats();
  });
}

function getMonacoTheme(appTheme) {
  const map = {
    'quiet-light': 'quiet-light',
    'dracula': 'dracula',
    'matcha': 'matcha'
  };
  return map[appTheme] || 'quiet-light';
}

/**
 * Render file tree
 */
function renderFileTree() {
  const container = document.getElementById('file-tree');
  if (!container) return;
  container.innerHTML = renderFolder(fileTree, '');
}

function renderFolder(items, path) {
  return Object.entries(items).map(([name, item]) => {
    const fullPath = path ? `${path}/${name}` : name;
    if (item.type === 'folder') {
      return `
        <div class="folder-item">
          <div class="folder-header" onclick="toggleFolder(this)">
            <svg class="chevron-icon ${item.expanded ? '' : 'collapsed'}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span>${name}</span>
          </div>
          <div class="folder-children ${item.expanded ? '' : 'hidden'}">
            ${renderFolder(item.children, fullPath)}
          </div>
        </div>
      `;
    } else {
      const isActive = fullPath === activeFile;
      const isModified = item.modified;
      return `
        <div class="file-item ${isActive ? 'active' : ''}" onclick="openFile('${fullPath}')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          </svg>
          <span>${name}${isModified ? '*' : ''}</span>
        </div>
      `;
    }
  }).join('');
}

function toggleFolder(el) {
  el.querySelector('.chevron-icon').classList.toggle('collapsed');
  el.nextElementSibling.classList.toggle('hidden');
}

/**
 * Tabs and Files
 */
function openFile(path) {
  activeFile = path;
  if (!openTabs.includes(path)) openTabs.push(path);
  
  const file = getFile(path);
  if (editor && file) {
    editor.setValue(file.content);
    monaco.editor.setModelLanguage(editor.getModel(), file.language || 'typescript');
  }
  
  renderTabs();
  renderFileTree();
}

function closeTab(path, e) {
  e?.stopPropagation();
  const index = openTabs.indexOf(path);
  if (index > -1) openTabs.splice(index, 1);
  if (activeFile === path && openTabs.length > 0) openFile(openTabs[0]);
  renderTabs();
  renderFileTree();
}

function renderTabs() {
  const container = document.getElementById('editor-tabs');
  if (!container) return;
  container.innerHTML = openTabs.map(path => {
    const name = path.split('/').pop();
    const isActive = path === activeFile;
    return `
      <button class="editor-tab ${isActive ? 'active' : ''}" onclick="openFile('${path}')">
        <span>${name}</span>
        <span class="close-tab" onclick="closeTab('${path}', event)">&times;</span>
      </button>
    `;
  }).join('');
}

function getFile(path) {
  const parts = path.split('/');
  let current = fileTree;
  for (const part of parts) {
    if (current.children) current = current.children[part];
    else if (current[part]) current = current[part];
    else return null;
  }
  return current;
}

/**
 * Sidebar Rendering Enhancements (requested by user)
 */
function renderVersions() {
  const container = document.getElementById('version-list');
  if (!container) return;
  container.innerHTML = versions.map(v => `
    <div class="version-item ${v.current ? 'active' : ''}" onclick="window.loadVersion('${v.id}')">
      <div class="version-name">
        <span>${v.name}</span>
        ${v.current ? '<span class="version-badge">current</span>' : ''}
      </div>
      <div class="version-date">${v.date}</div>
      <div class="version-comment">"${v.comment}"</div>
    </div>
  `).join('');
}

function renderTestVideos() {
  const container = document.getElementById('test-videos-list');
  if (!container) return;
  container.innerHTML = testVideos.map(video => `
    <div class="test-video-item" id="video-card-${video.id}" onclick="toggleVideoSelection(this, '${video.id}')">
      <input type="checkbox" class="test-video-checkbox" id="check-${video.id}">
      <div class="test-video-content">
        <div class="test-video-header">
          <span class="test-video-name">${video.name}</span>
          <span class="test-video-meta">${video.duration}</span>
        </div>
        <div class="test-video-meta">${video.expectedSteps} expected steps</div>
      </div>
    </div>
  `).join('');
}

function toggleVideoSelection(el, id) {
  const checkbox = document.getElementById(`check-${id}`);
  checkbox.checked = !checkbox.checked;
  const card = document.getElementById(`video-card-${id}`);
  card.classList.toggle('selected', checkbox.checked);
  
  const count = document.querySelectorAll('.test-video-checkbox:checked').length;
  document.getElementById('selected-count').textContent = `${count} selected`;
}

function updateStats() {
  if (!editor) return;
  const content = editor.getValue();
  document.getElementById('line-count').textContent = `${content.split('\n').length} lines`;
  document.getElementById('char-count').textContent = `${content.length} chars`;
}

// Global Exports
window.openFile = openFile;
window.closeTab = closeTab;
window.toggleFolder = toggleFolder;
window.toggleVideoSelection = toggleVideoSelection;
window.loadVersion = (id) => console.log('Loading version:', id);

document.addEventListener('DOMContentLoaded', initEditor);
