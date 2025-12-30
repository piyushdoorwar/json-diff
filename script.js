    const editors = {
      left: document.getElementById("jsonA"),
      right: document.getElementById("jsonB"),
    };
    const indentSizeInput = document.getElementById("indentSize");
    const indentTypeSelect = document.getElementById("indentType");
    const diffOutput = document.getElementById("diffOutput");
    const summaryLine = document.getElementById("summaryLine");
    const statusMessage = document.getElementById("statusMessage");

    document.querySelectorAll("[data-format-target]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.formatTarget === "left" ? editors.left : editors.right;
        formatEditor(target);
      });
    });

    document.getElementById("beautifyAll").addEventListener("click", () => {
      formatEditor(editors.left);
      formatEditor(editors.right);
    });

    document.getElementById("compareBtn").addEventListener("click", () => {
      compareJson();
    });

    function formatEditor(editor) {
      const value = editor.value.trim();
      if (!value) {
        statusMessage.textContent = "Paste JSON on that side to format it.";
        return;
      }
      const parsed = tryParse(value);
      if (!parsed) {
        statusMessage.textContent = "Unable to parse JSON. Please fix syntax errors.";
        return;
      }
      statusMessage.textContent = "";
      const indent = indentTypeSelect.value === "tabs" ? "\t" : Number(indentSizeInput.value) || 2;
      editor.value = JSON.stringify(parsed, null, indent);
    }

    function compareJson() {
      const leftData = tryParse(editors.left.value.trim());
      const rightData = tryParse(editors.right.value.trim());
      if (!leftData || !rightData) {
        statusMessage.textContent = "Make sure both sides contain valid JSON to run the comparison.";
        return;
      }
      statusMessage.textContent = "";
      const entries = diffObjects(leftData, rightData);
      renderDiff(entries);
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

    function renderDiff(entries) {
      diffOutput.innerHTML = "";
      if (!entries.length) {
        summaryLine.textContent = "No differences detected.";
        diffOutput.innerHTML = "<div class=\"diff-entry status-modified\">No textual delta found.</div>";
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

    function escapeHtml(text) {
      return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }