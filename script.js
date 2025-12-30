    const editors = {
      left: document.getElementById("jsonA"),
      right: document.getElementById("jsonB"),
    };
    const diffOutput = document.getElementById("diffOutput");
    const summaryLine = document.getElementById("summaryLine");
    const statusMessage = document.getElementById("statusMessage");
    const mergedOutput = document.getElementById("mergedOutput");
    const sortKeysInput = document.getElementById("sortKeys");
    const keyCaseSelect = document.getElementById("keyCase");
    const toastContainer = document.getElementById("toast-container");

    let lastLeftData, lastRightData, lastEntries;

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

    // Add event listeners for indent controls
    document.querySelectorAll(".indent-size-input, .indent-type-select").forEach((control) => {
      control.addEventListener("change", () => {
        const editorSide = control.dataset.editor;
        const editor = editorSide === "left" ? editors.left : editors.right;
        const settings = getIndentSettings(editorSide);
        
        // Update editor settings
        editor.setOption("indentUnit", settings.type === "tabs" ? 1 : settings.size);
        editor.setOption("indentWithTabs", settings.type === "tabs");
        
        // Reformat existing content to apply new indent settings
        const value = editor.getValue().trim();
        if (value) {
          const parsed = tryParse(value);
          if (parsed) {
            const indent = settings.type === "tabs" ? "\t" : " ".repeat(settings.size);
            editor.setValue(JSON.stringify(parsed, null, indent));
          }
        }
      });
    });

    // Icon button event handlers
    document.querySelectorAll(".icon-btn").forEach((btn) => {
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

    function getIndentSettings(editorSide) {
      const indentSizeInput = document.querySelector(`.indent-size-input[data-editor="${editorSide}"]`);
      const indentTypeSelect = document.querySelector(`.indent-type-select[data-editor="${editorSide}"]`);
      return {
        size: Number(indentSizeInput.value) || 2,
        type: indentTypeSelect.value
      };
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
      const settings = getIndentSettings(editorSide);
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

    document.getElementById("compareBtn").addEventListener("click", () => {
      compareJson();
    });

    sortKeysInput.addEventListener("change", () => {
      if (lastLeftData) renderMerged(mergedOutput, lastLeftData, lastRightData, lastEntries, sortKeysInput.checked, keyCaseSelect.value);
    });

    keyCaseSelect.addEventListener("change", () => {
      if (lastLeftData) renderMerged(mergedOutput, lastLeftData, lastRightData, lastEntries, sortKeysInput.checked, keyCaseSelect.value);
    });

    function compareJson() {
      const leftData = tryParse(editors.left.getValue().trim());
      const rightData = tryParse(editors.right.getValue().trim());
      if (!leftData || !rightData) {
        statusMessage.textContent = "Make sure both sides contain valid JSON to run the comparison.";
        return;
      }
      statusMessage.textContent = "";
      const entries = diffObjects(leftData, rightData);
      renderDiff(entries, leftData, rightData);
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

    function renderDiff(entries, leftData, rightData) {
      diffOutput.innerHTML = "";
      mergedOutput.innerHTML = "";
      if (!entries.length) {
        summaryLine.textContent = "No differences detected.";
        diffOutput.innerHTML = "<div class=\"diff-entry status-modified\">No textual delta found.</div>";
        renderMerged(mergedOutput, leftData, rightData, entries, sortKeysInput.checked, keyCaseSelect.value);
        return;
      }
      const counts = entries.reduce(
        (acc, entry) => {
          acc[entry.status] = (acc[entry.status] || 0) + 1;
          return acc;
        },
        { missing: 0, addition: 0, minor: 0, modified: 0 }
      );
      summaryLine.textContent = `Missing ${counts.missing}, Added ${counts.addition}, Minor ${counts.minor}, Updates ${counts.modified}`;
      renderMerged(mergedOutput, leftData, rightData, entries, sortKeysInput.checked, keyCaseSelect.value);
      entries.forEach((entry) => {
        const node = document.createElement("div");
        node.classList.add("diff-entry", `status-${entry.status}`);
        const pathLine = document.createElement("div");
        pathLine.classList.add("diff-path");
        pathLine.textContent = entry.path;
        node.appendChild(pathLine);
        const detail = document.createElement("div");
        if (entry.status === "missing") {
          detail.innerHTML = `<div class=\"value-line\">Missing value: ${escapeHtml(valueToString(entry.oldValue))}</div>`;
        } else if (entry.status === "addition") {
          detail.innerHTML = `<div class=\"value-line\">Added value: ${escapeHtml(valueToString(entry.newValue))}</div>`;
        } else {
          detail.innerHTML = `<div class=\"value-line\">Old: ${escapeHtml(valueToString(entry.oldValue))}</div><div class=\"value-line\">New: ${escapeHtml(valueToString(entry.newValue))}</div>`;
        }
        node.appendChild(detail);
        diffOutput.appendChild(node);
      });
    }

    function valueToString(value) {
      if (typeof value === "undefined") {
        return "(undefined)";
      }
      if (typeof value === "object") {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
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