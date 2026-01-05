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

    // Initialize CodeMirror editors
    editors.left = CodeMirror.fromTextArea(editors.left, {
      mode: "application/json",
      theme: "material",
      lineNumbers: true,
      indentUnit: 2,
      smartIndent: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      lineWrapping: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
    });
    editors.right = CodeMirror.fromTextArea(editors.right, {
      mode: "application/json",
      theme: "material",
      lineNumbers: true,
      indentUnit: 2,
      smartIndent: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      lineWrapping: true,
      gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]
    });

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

    editors.left.setValue(JSON.stringify(sampleOriginal, null, 2));
    editors.right.setValue(JSON.stringify(sampleModified, null, 2));

    // Indent settings (applies to both editors)
    function getIndentSettings() {
      return {
        size: Number(indentSizeInput?.value) || 2,
        type: indentTypeSelect?.value || "spaces",
      };
    }

    function applyIndentSettingsToEditors(reformat = true) {
      const settings = getIndentSettings();
      const indentUnit = settings.type === "tabs" ? 1 : settings.size;
      const indentWithTabs = settings.type === "tabs";
      const indent = settings.type === "tabs" ? "\t" : " ".repeat(settings.size);

      [editors.left, editors.right].forEach((editor) => {
        editor.setOption("indentUnit", indentUnit);
        editor.setOption("indentWithTabs", indentWithTabs);

        if (!reformat) return;
        const value = editor.getValue().trim();
        if (!value) return;
        const parsed = tryParse(value);
        if (!parsed) return;
        editor.setValue(JSON.stringify(parsed, null, indent));
      });
    }

    [indentSizeInput, indentTypeSelect].filter(Boolean).forEach((control) => {
      control.addEventListener("change", () => {
        applyIndentSettingsToEditors(true);
        scheduleCompare();
      });
    });

    // Icon button event handlers
    document.querySelectorAll(".icon-btn[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const editorSide = btn.dataset.editor;
        const editor = editorSide === "left" ? editors.left : editors.right;
        
        switch (action) {
          case "settings":
            openSettingsModal(editorSide);
            break;
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
      const editor = editorSide === "left" ? editors.left : editors.right;
      const tracked = editorDiffHighlights[editorSide];
      tracked.forEach((line) => {
        editor.removeLineClass(line, "background", "line-diff-missing");
        editor.removeLineClass(line, "background", "line-diff-addition");
        editor.removeLineClass(line, "background", "line-diff-minor");
        editor.removeLineClass(line, "background", "line-diff-modified");
      });
      tracked.clear();
    }

    function addDiffHighlight(editorSide, line, status) {
      if (typeof line !== "number" || line < 0) return;
      const editor = editorSide === "left" ? editors.left : editors.right;
      const tracked = editorDiffHighlights[editorSide];

      const className =
        status === "missing" ? "line-diff-missing" :
        status === "addition" ? "line-diff-addition" :
        status === "minor" ? "line-diff-minor" :
        status === "modified" ? "line-diff-modified" :
        "";
      if (!className) return;
      editor.addLineClass(line, "background", className);
      tracked.add(line);
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
      const lines = editor.getValue().split("\n");
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
      const value = editor.getValue().trim();
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
      editor.setValue(JSON.stringify(parsed, null, indent));
      editor.setOption("indentUnit", settings.type === "tabs" ? 1 : settings.size);
      showToast("JSON beautified successfully", "success");
    }

    function validateJSON(editor) {
      const value = editor.getValue().trim();
      if (!value) {
        showToast("No JSON to validate", "error");
        return;
      }
      
      // Clear any previous error highlighting
      editor.getAllMarks().forEach(mark => mark.clear());
      
      try {
        JSON.parse(value);
        showToast("Valid JSON ✓", "success");
      } catch (error) {
        // Extract line number from error message
        const lineMatch = error.message.match(/position (\d+)/);
        let lineNum = null;
        
        if (lineMatch) {
          const position = parseInt(lineMatch[1]);
          const beforeError = value.substring(0, position);
          lineNum = beforeError.split('\n').length;
        }
        
        // Fallback: try to find line from other error patterns
        if (!lineNum) {
          const jsonLineMatch = error.message.match(/line (\d+)/i);
          if (jsonLineMatch) {
            lineNum = parseInt(jsonLineMatch[1]);
          }
        }
        
        if (lineNum) {
          // Highlight the error line
          const line = lineNum - 1; // CodeMirror uses 0-based indexing
          editor.addLineClass(line, "background", "line-error");
          
          // Create a marker for the line
          const from = { line: line, ch: 0 };
          const to = { line: line, ch: editor.getLine(line).length };
          editor.markText(from, to, { 
            className: "error-text",
            clearOnEnter: true
          });
          
          // Scroll to the error line
          editor.scrollIntoView({ line: line, ch: 0 }, 100);
          
          showToast(`Invalid JSON - Error on line ${lineNum}`, "error");
        } else {
          showToast(`Invalid JSON - ${error.message}`, "error");
        }
      }
    }

    function copyJSON(editor) {
      const value = editor.getValue();
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
        editor.setValue(text);
        showToast("Pasted from clipboard", "success");
      }).catch(() => {
        showToast("Failed to paste - clipboard access denied", "error");
      });
    }

    function clearJSON(editor) {
      if (!editor.getValue().trim()) {
        showToast("Already empty", "info");
        return;
      }
      editor.setValue("");
      showToast("Editor cleared", "success");
    }

    // Auto-compare whenever either editor changes
    editors.left.on("change", scheduleCompare);
    editors.right.on("change", scheduleCompare);

    // Run an initial comparison for any prefilled content
    scheduleCompare();

    function compareJson() {
      const leftData = tryParse(editors.left.getValue().trim());
      const rightData = tryParse(editors.right.getValue().trim());
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

    function renderMerged(output, leftData, rightData, entries, sortKeys, keyCase) {
      const diffMap = new Map();
      entries.forEach(entry => {
        diffMap.set(entry.path, entry);
      });
      const mergedObj = mergeWithLeft(rightData, leftData);
      const mergedString = buildMergedString(mergedObj, "", diffMap, 0, sortKeys, keyCase);
      output.innerHTML = mergedString;
    }

    function mergeWithLeft(right, left) {
      if (isObject(right) && isObject(left) && !Array.isArray(right) && !Array.isArray(left)) {
        const merged = {};
        const allKeys = new Set([...Object.keys(right), ...Object.keys(left)]);
        allKeys.forEach(key => {
          if (right.hasOwnProperty(key) && left.hasOwnProperty(key)) {
            merged[key] = mergeWithLeft(right[key], left[key]);
          } else if (right.hasOwnProperty(key)) {
            merged[key] = mergeWithLeft(right[key], left[key]);
          } else {
            merged[key] = mergeWithLeft(left[key], left[key]);
          }
        });
        return merged;
      }
      return right !== undefined ? right : left;
    }

    function transformKeyCase(key, casing) {
      switch (casing) {
        case "camel":
          return toCamelCase(key);
        case "pascal":
          return toPascalCase(key);
        case "snake":
          return toSnakeCase(key);
        case "kebab":
          return toKebabCase(key);
        case "upper":
          return key.toUpperCase();
        default:
          return key;
      }
    }

    function toCamelCase(str) {
      return str.replace(/[-_](.)/g, (_, letter) => letter.toUpperCase());
    }

    function toPascalCase(str) {
      return str.replace(/(^|[-_])(.)/g, (_, __, letter) => letter.toUpperCase());
    }

    function toSnakeCase(str) {
      return str.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[-]/g, '_').toLowerCase();
    }

    function toKebabCase(str) {
      return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[_]/g, '-').toLowerCase();
    }

    function buildMergedString(obj, path, diffMap, indentLevel, sortKeys, keyCase) {
      const indent = "  ".repeat(indentLevel);
      if (obj === null) {
        return "null";
      }
      if (typeof obj === "boolean") {
        return obj.toString();
      }
      if (typeof obj === "number") {
        return obj.toString();
      }
      if (typeof obj === "string") {
        const currentPath = path;
        const diff = diffMap.get(currentPath);
        let className = "";
        if (diff) {
          if (diff.status === "missing") className = "diff-missing";
          else if (diff.status === "addition") className = "diff-addition";
          else if (diff.status === "minor") className = "diff-minor";
          else if (diff.status === "modified") className = "diff-modified";
        }
        const escaped = escapeHtml(JSON.stringify(obj));
        return className ? `<span class="${className}">${escaped}</span>` : escaped;
      }
      if (Array.isArray(obj)) {
        const items = obj.map((item, index) => {
          const itemPath = path ? `${path}[${index}]` : `[${index}]`;
          return buildMergedString(item, itemPath, diffMap, indentLevel, sortKeys, keyCase);
        });
        return `[\n${indent}  ${items.join(`,\n${indent}  `)}\n${indent}]`;
      }
      if (typeof obj === "object") {
        let keys = Object.keys(obj);
        if (sortKeys) {
          keys.sort();
        }
        const entries = keys.map(key => {
          const transformedKey = transformKeyCase(key, keyCase);
          const valuePath = path ? `${path}.${key}` : key;
          const diff = diffMap.get(valuePath);
          let keyClass = "";
          let valueClass = "";
          if (diff) {
            if (diff.status === "missing") {
              keyClass = valueClass = "diff-missing";
            } else if (diff.status === "addition") {
              keyClass = valueClass = "diff-addition";
            } else if (diff.status === "minor") {
              keyClass = valueClass = "diff-minor";
            } else if (diff.status === "modified") {
              keyClass = valueClass = "diff-modified";
            }
          }
          const keyStr = keyClass ? `<span class="${keyClass}">"${transformedKey}"</span>` : `"${transformedKey}"`;
          const valueStr = buildMergedString(obj[key], valuePath, diffMap, indentLevel + 1, sortKeys, keyCase);
          return `${indent}  ${keyStr}: ${valueStr}`;
        });
        return `{\n${entries.join(",\n")}\n${indent}}`;
      }
      return "";
    }

    function escapeHtml(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }