const editors = {
  left: document.getElementById("jsonA"),
  right: document.getElementById("jsonB"),
};
const toastContainer = document.getElementById("toast-container");
const settingsModal = document.getElementById("settingsModal");
const settingsCloseBtn = document.getElementById("settingsCloseBtn");
const indentSizeInput = document.getElementById("indentSize");
const indentTypeSelect = document.getElementById("indentType");

let lastLeftData, lastRightData, lastEntries;
let compareTimer;
const compareDebounceMs = 250;
let lastSettingsAnchor = "settings-indent";

const editorDiffHighlights = {
  left: new Set(),
  right: new Set(),
};

// Toast notification function
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconClass = "fa-info-circle";
  if (type === "success") iconClass = "fa-check-circle";
  else if (type === "error") iconClass = "fa-exclamation-circle";
  
  toast.innerHTML = `
    <i class="fas ${iconClass} toast-icon"></i>
    <div class="toast-message">${message}</div>
  `;
  
  toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Load sample JSON on initialization
const sampleOriginal = {
  "user": {
    "id": 12345,
    "username": "johndoe",
    "email": "john@example.com",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "age": 28,
      "location": "New York"
    },
    "settings": {
      "theme": "dark",
      "notifications": true,
      "language": "en"
    },
    "lastLogin": "2025-12-29T14:32:15Z",
    "createdAt": "2023-01-15T08:00:00Z"
  },
  "subscription": {
    "plan": "basic",
    "status": "active",
    "price": 9.99
  },
  "features": ["email", "chat", "storage"]
};

const sampleModified = {
  "user": {
    "id": 12345,
    "username": "johndoe_updated",
    "email": "john.doe@newdomain.com",
    "profile": {
      "firstName": "John",
      "lastName": "Doe",
      "age": 29,
      "location": "San Francisco",
      "bio": "Software Developer"
    },
    "settings": {
      "theme": "light",
      "notifications": true,
      "privacy": "public"
    },
    "lastLogin": "2025-12-30T10:15:42Z",
    "updatedAt": "2025-12-30T10:15:42Z"
  },
  "subscription": {
    "plan": "premium",
    "status": "active",
    "price": 19.99,
    "renewalDate": "2026-01-30"
  },
  "features": ["email", "chat", "storage", "analytics", "api-access"]
};

editors.left.textContent = JSON.stringify(sampleOriginal, null, 2);
editors.right.textContent = JSON.stringify(sampleModified, null, 2);

// Indent settings (applies to both editors)
function getIndentSettings() {
  return {
    size: Number(indentSizeInput?.value) || 2,
    type: indentTypeSelect?.value || "spaces",
  };
}

function applyIndentSettingsToEditors(reformat = true) {
  const settings = getIndentSettings();
  const indent = settings.type === "tabs" ? "\t" : " ".repeat(settings.size);

  [editors.left, editors.right].forEach((editor) => {
    if (!reformat) return;
    const value = editor.textContent.trim();
    if (!value) return;
    const parsed = tryParse(value);
    if (!parsed) return;
    editor.textContent = JSON.stringify(parsed, null, indent);
  });
}

[indentSizeInput, indentTypeSelect].filter(Boolean).forEach((control) => {
  control.addEventListener("change", () => {
    applyIndentSettingsToEditors(true);
    scheduleCompare();
  });
});

// Action button event handlers
document.querySelectorAll(".action-btn[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    const editorSide = btn.dataset.editor;
    const editor = editorSide === "left" ? editors.left : editors.right;
    
    switch (action) {
      case "beautify":
        beautifyJSON(editor, editorSide);
        break;
      case "validate":
        validateJSON(editor);
        break;
      case "copy":
        copyJSON(editor);
        break;
      case "paste":
        pasteJSON(editor);
        break;
      case "clear":
        clearJSON(editor);
        break;
    }
  });
});

function openSettingsModal(editorSide = "left") {
  if (!settingsModal) return;
  lastSettingsAnchor = "settings-indent";
  settingsModal.classList.add("is-open");
  settingsModal.setAttribute("aria-hidden", "false");

  const anchor = document.getElementById(lastSettingsAnchor);
  if (anchor) {
    anchor.scrollIntoView({ block: "nearest" });
  }

  // Move focus into the modal for keyboard users
  if (settingsCloseBtn) settingsCloseBtn.focus();
}

function closeSettingsModal() {
  if (!settingsModal) return;
  settingsModal.classList.remove("is-open");
  settingsModal.setAttribute("aria-hidden", "true");
}

if (settingsCloseBtn) {
  settingsCloseBtn.addEventListener("click", closeSettingsModal);
}

if (settingsModal) {
  settingsModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.matches && target.matches("[data-modal-close]")) {
      closeSettingsModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && settingsModal && settingsModal.classList.contains("is-open")) {
    closeSettingsModal();
  }
});

function scheduleCompare() {
  if (compareTimer) {
    clearTimeout(compareTimer);
  }
  compareTimer = setTimeout(() => {
    compareJson();
  }, compareDebounceMs);
}

function clearDiffHighlights(editorSide) {
  const lineNumbers = editorSide === "left" ? document.getElementById("left-line-numbers") : document.getElementById("right-line-numbers");
  const lines = lineNumbers.querySelectorAll('.line-number');
  lines.forEach((line) => {
    line.classList.remove("line-diff-missing", "line-diff-addition", "line-diff-minor", "line-diff-modified");
  });
}

function addDiffHighlight(editorSide, line, status) {
  if (typeof line !== "number" || line < 0) return;
  const lineNumbers = editorSide === "left" ? document.getElementById("left-line-numbers") : document.getElementById("right-line-numbers");
  const lines = lineNumbers.querySelectorAll('.line-number');
  if (lines[line]) {
    const className =
      status === "missing" ? "line-diff-missing" :
      status === "addition" ? "line-diff-addition" :
      status === "minor" ? "line-diff-minor" :
      status === "modified" ? "line-diff-modified" :
      "";
    if (className) lines[line].classList.add(className);
  }
}

function parsePath(path) {
  const parts = [];
  const regex = /([^.[\]]+)|\[(\d+)\]/g;
  let match;
  while ((match = regex.exec(path)) !== null) {
    if (match[1] !== undefined) parts.push(match[1]);
    else parts.push(Number(match[2]));
  }
  return parts;
}

function getLastKeyFromPath(path) {
  const parts = parsePath(path);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (typeof parts[i] === "string") return parts[i];
  }
  return null;
}

function findBestLineForKeyAndValue(editor, key, value) {
  const lines = editor.textContent.split("\n");
  const keyToken = key ? `"${key}"` : null;

  const isPrimitive = (v) => v === null || ["string", "number", "boolean"].includes(typeof v);
  const valueToken = isPrimitive(value) ? JSON.stringify(value) : null;

  if (keyToken && valueToken) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(keyToken) && line.includes(valueToken)) return i;
    }
  }

  if (keyToken && !valueToken) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes(keyToken)) continue;
      if (line.includes("{") || line.includes("[")) return i;
    }
  }

  if (keyToken) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(keyToken)) return i;
    }
  }

  return null;
}

function applyDiffHighlightsFromEntries(entries) {
  clearDiffHighlights("left");
  clearDiffHighlights("right");

  entries.forEach((entry) => {
    const key = getLastKeyFromPath(entry.path);

    if (entry.status === "missing") {
      const line = findBestLineForKeyAndValue(editors.left, key, entry.oldValue);
      if (line !== null) addDiffHighlight("left", line, "missing");
      return;
    }

    if (entry.status === "addition") {
      const line = findBestLineForKeyAndValue(editors.right, key, entry.newValue);
      if (line !== null) addDiffHighlight("right", line, "addition");
      return;
    }

    const leftLine = findBestLineForKeyAndValue(editors.left, key, entry.oldValue);
    const rightLine = findBestLineForKeyAndValue(editors.right, key, entry.newValue);
    if (leftLine !== null) addDiffHighlight("left", leftLine, entry.status);
    if (rightLine !== null) addDiffHighlight("right", rightLine, entry.status);
  });
}

function beautifyJSON(editor, editorSide) {
  const value = editor.textContent.trim();
  if (!value) {
    showToast("No JSON to beautify", "error");
    return;
  }
  const parsed = tryParse(value);
  if (!parsed) {
    showToast("Invalid JSON - cannot beautify", "error");
    return;
  }
  const settings = getIndentSettings();
  const indent = settings.type === "tabs" ? "\t" : " ".repeat(settings.size);
  editor.textContent = JSON.stringify(parsed, null, indent);
  updateLineNumbers(editorSide === "left" ? "jsonA" : "jsonB");
  showToast("JSON beautified successfully", "success");
}

function validateJSON(editor) {
  const value = editor.textContent.trim();
  if (!value) {
    showToast("No JSON to validate", "error");
    return;
  }
  
  try {
    JSON.parse(value);
    showToast("Valid JSON ✓", "success");
  } catch (error) {
    showToast(`Invalid JSON - ${error.message}`, "error");
  }
}

function copyJSON(editor) {
  const value = editor.textContent;
  if (!value.trim()) {
    showToast("Nothing to copy", "error");
    return;
  }
  navigator.clipboard.writeText(value).then(() => {
    showToast("Copied to clipboard", "success");
  }).catch(() => {
    showToast("Failed to copy", "error");
  });
}

function pasteJSON(editor) {
  navigator.clipboard.readText().then((text) => {
    if (!text) {
      showToast("Clipboard is empty", "error");
      return;
    }
    const editorId = event.target.closest('.editor-panel').querySelector('.editor-textarea').id;
    document.getElementById(editorId).textContent = text;
    updateLineNumbers(editorId);
    showToast("Pasted from clipboard", "success");
  }).catch(() => {
    showToast("Failed to paste - clipboard access denied", "error");
  });
}

function clearJSON(editor) {
  if (!editor.textContent.trim()) {
    showToast("Already empty", "info");
    return;
  }
  editor.textContent = "";
  updateLineNumbers(editor.id);
  showToast("Editor cleared", "success");
}

// Auto-compare whenever either editor changes
editors.left.addEventListener("input", () => {
  updateLineNumbers('jsonA');
  scheduleCompare();
});
editors.right.addEventListener("input", () => {
  updateLineNumbers('jsonB');
  scheduleCompare();
});

// Run an initial comparison for any prefilled content
scheduleCompare();

function compareJson() {
  const leftData = tryParse(editors.left.textContent.trim());
  const rightData = tryParse(editors.right.textContent.trim());
  if (!leftData || !rightData) {
    lastLeftData = null;
    lastRightData = null;
    lastEntries = null;
    clearDiffHighlights("left");
    clearDiffHighlights("right");
    return;
  }
  const entries = diffObjects(leftData, rightData);
  applyDiffHighlightsFromEntries(entries);
  lastLeftData = leftData;
  lastRightData = rightData;
  lastEntries = entries;
}

function tryParse(value) {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function diffObjects(left, right, path = "") {
  const results = [];
  if (isObject(left) && isObject(right)) {
    new Set([...Object.keys(left), ...Object.keys(right)]).forEach((key) => {
      const currentPath = path ? `${path}.${key}` : key;
      const hasLeft = Object.prototype.hasOwnProperty.call(left, key);
      const hasRight = Object.prototype.hasOwnProperty.call(right, key);
      if (hasLeft && !hasRight) {
        results.push({
          path: currentPath,
          status: "missing",
          oldValue: left[key],
        });
      } else if (!hasLeft && hasRight) {
        results.push({
          path: currentPath,
          status: "addition",
          newValue: right[key],
        });
      } else {
        const leftVal = left[key];
        const rightVal = right[key];
        if (isObject(leftVal) && isObject(rightVal) && !Array.isArray(leftVal) && !Array.isArray(rightVal)) {
          results.push(...diffObjects(leftVal, rightVal, currentPath));
        } else if (!isEqual(leftVal, rightVal)) {
          const minor = markAsMinor(currentPath, leftVal, rightVal);
          results.push({
            path: currentPath,
            status: minor ? "minor" : "modified",
            oldValue: leftVal,
            newValue: rightVal,
          });
        }
      }
    });
  }
  return results;
}

function markAsMinor(path, oldValue, newValue) {
  const minimals = ["time", "date", "timestamp", "updated", "created", "last", "expires", "logged"];
  const normalized = path.toLowerCase();
  if (minimals.some((token) => normalized.includes(token))) {
    return true;
  }
  const stringValue = (value) => (typeof value === "string" ? value : "");
  const dateish = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
  if (dateish.test(stringValue(oldValue)) && dateish.test(stringValue(newValue))) {
    return true;
  }
  if (typeof oldValue === "number" && typeof newValue === "number") {
    return Math.abs(oldValue - newValue) < 1;
  }
  return false;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

function isEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (isObject(a) && isObject(b)) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

// Initialize line numbers
function updateLineNumbers(editorId) {
  const editor = document.getElementById(editorId);
  const lineNumbers = document.getElementById(editorId === 'jsonA' ? 'left-line-numbers' : 'right-line-numbers');
  const lines = editor.textContent.split('\n').length;
  lineNumbers.innerHTML = '';
  for (let i = 1; i <= lines; i++) {
    const div = document.createElement('div');
    div.className = 'line-number';
    div.textContent = i;
    lineNumbers.appendChild(div);
  }
}

// Initial line numbers
updateLineNumbers('jsonA');
updateLineNumbers('jsonB');

// Settings button
document.getElementById('settings-btn').addEventListener('click', () => openSettingsModal());
