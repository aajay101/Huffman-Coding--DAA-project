(function() {
    var layoutExpanded = false;

    var codeLines = [
        "<span class='interactive-token-keyword'>def</span> <span class='interactive-token-function'>build_huffman</span>(text):",
        "    freq = {}",
        "    <span class='interactive-token-keyword'>for</span> ch <span class='interactive-token-keyword'>in</span> text:",
        "        freq[ch] = freq.get(ch, <span class='interactive-token-number'>0</span>) + <span class='interactive-token-number'>1</span>",
        "",
        "    heap = []",
        "    order = <span class='interactive-token-number'>0</span>",
        "    <span class='interactive-token-keyword'>for</span> ch, count <span class='interactive-token-keyword'>in</span> freq.items():",
        "        heappush(heap, (count, order, Node(ch, count)))",
        "        order += <span class='interactive-token-number'>1</span>",
        "",
        "    <span class='interactive-token-keyword'>while</span> len(heap) &gt; <span class='interactive-token-number'>1</span>:",
        "        left = heappop(heap).node",
        "        right = heappop(heap).node",
        "        parent = Node(left.label + right.label, left.freq + right.freq, left, right)",
        "        heappush(heap, (parent.freq, order, parent))",
        "        order += <span class='interactive-token-number'>1</span>",
        "",
        "    root = heap[<span class='interactive-token-number'>0</span>].node",
        "    codes = {}",
        "    assign_codes(root, <span class='interactive-token-string'>\"\"</span>, codes)",
        "    encoded_text = <span class='interactive-token-string'>\"\"</span>.join(codes[ch] <span class='interactive-token-keyword'>for</span> ch <span class='interactive-token-keyword'>in</span> text)",
        "    <span class='interactive-token-keyword'>return</span> root, codes, encoded_text"
    ];

    var phaseToLines = {
        initialize: [1],
        count: [2, 3, 4],
        heap: [6, 7, 8, 9, 10],
        merge: [12, 13, 14, 15, 16, 17],
        "tree-complete": [19],
        codes: [20, 21],
        "codes-complete": [20, 21],
        encode: [22],
        complete: [22, 23]
    };

    var codeRows = [];

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function ensureCodeView() {
        if (codeRows.length) return;
        var root = document.getElementById("interactive-code-view");
        if (!root) return;

        codeRows = codeLines.map(function(line, index) {
            var row = document.createElement("div");
            row.className = "interactive-code-line";
            row.innerHTML = [
                '<span class="interactive-code-line-number">' + (index + 1) + "</span>",
                '<span class="interactive-code-line-content">' + (line || " ") + "</span>"
            ].join("");
            root.appendChild(row);
            return row;
        });
    }

    function renderCode(step) {
        ensureCodeView();
        var highlightedLines = phaseToLines[step.phase] || [];

        codeRows.forEach(function(row, index) {
            var lineNumber = index + 1;
            var isHighlighted = highlightedLines.indexOf(lineNumber) >= 0;
            row.classList.toggle("is-highlighted", isHighlighted);
            row.classList.toggle("is-muted", !isHighlighted && highlightedLines.length > 0);
        });
    }

    function renderFrequencyTable(entries) {
        var body = document.getElementById("interactive-frequency-body");
        if (!body) return;

        if (!entries.length) {
            body.innerHTML = '<tr><td colspan="3" class="interactive-empty-row">Frequency updates appear here.</td></tr>';
            return;
        }

        body.innerHTML = entries.map(function(entry) {
            return [
                '<tr class="interactive-table-row is-' + escapeHtml(entry.status) + '">',
                "<td>" + escapeHtml(entry.label) + "</td>",
                "<td>" + escapeHtml(entry.frequency) + "</td>",
                '<td><span class="interactive-status-pill is-' + escapeHtml(entry.status) + '">' + escapeHtml(entry.status) + "</span></td>",
                "</tr>"
            ].join("");
        }).join("");
    }

    function renderCodes(codes) {
        var body = document.getElementById("interactive-codes-body");
        if (!body) return;

        var entries = Object.keys(codes || {}).sort().map(function(key) {
            return [key, codes[key]];
        });

        if (!entries.length) {
            body.innerHTML = '<tr><td colspan="2" class="interactive-empty-row">Codes appear after tree traversal begins.</td></tr>';
            return;
        }

        body.innerHTML = entries.map(function(entry) {
            return [
                '<tr class="interactive-table-row is-created">',
                "<td>" + escapeHtml(entry[0] === " " ? "space" : entry[0]) + "</td>",
                "<td><code>" + escapeHtml(entry[1]) + "</code></td>",
                "</tr>"
            ].join("");
        }).join("");
    }

    function renderHeap(heapState, focusNodes) {
        var root = document.getElementById("interactive-heap");
        if (!root) return;

        if (!heapState || !heapState.length) {
            root.innerHTML = '<div class="interactive-empty-state">Heap nodes appear here as the priority queue is created.</div>';
            return;
        }

        var focusLookup = {};
        (focusNodes || []).forEach(function(id) {
            focusLookup[id] = true;
        });

        root.innerHTML = heapState.map(function(item) {
            var classes = ["interactive-heap-item"];
            if (focusLookup[item.id] || item.status === "focus" || item.status === "created") {
                classes.push("is-active");
            }

            return [
                '<div class="' + classes.join(" ") + '">',
                '<span class="interactive-heap-label">' + escapeHtml(item.label) + "</span>",
                '<span class="interactive-heap-weight">' + escapeHtml(item.frequency) + "</span>",
                "</div>"
            ].join("");
        }).join("");
    }

    function renderEncodedOutput(step, response) {
        var bits = document.getElementById("interactive-encoded-bits");
        var compactBits = document.getElementById("interactive-compact-bits");
        var text = document.getElementById("interactive-encoded-text");
        var currentChar = document.getElementById("interactive-current-char");

        var fullEncoded = response.encoded_text || "";
        var partial = step.encoded_partial || "";
        var remainder = fullEncoded.slice(partial.length);
        var emittedBits = step.emitted_bits || "";
        var characterLabel = step.current_character === " "
            ? "space"
            : step.current_character;

        if (bits) {
            bits.innerHTML = [
                '<span class="interactive-bitstream-revealed">' + escapeHtml(partial || "") + "</span>",
                '<span class="interactive-bitstream-pending">' + escapeHtml(remainder || "") + "</span>"
            ].join("");
        }

        if (compactBits) {
            compactBits.classList.toggle("is-empty", !partial && !emittedBits);
            if (step.phase === "complete" && partial) {
                compactBits.innerHTML = [
                    '<span class="interactive-bit-segment">Final encoded bitstream</span>',
                    '<span class="interactive-bitstream-revealed">' + escapeHtml(partial) + "</span>"
                ].join("");
            } else if (partial) {
                compactBits.innerHTML = [
                    emittedBits
                        ? '<span class="interactive-bit-segment">' + escapeHtml(characterLabel) + " -> " + escapeHtml(emittedBits) + "</span>"
                        : "",
                    '<span class="interactive-bitstream-revealed">' + escapeHtml(partial) + "</span>",
                    '<span class="interactive-bitstream-pending">' + escapeHtml(remainder || "") + "</span>"
                ].join("");
            } else if (emittedBits) {
                compactBits.innerHTML = '<span class="interactive-bit-segment">' + escapeHtml(characterLabel) + " -> " + escapeHtml(emittedBits) + "</span>";
            } else {
                compactBits.textContent = "No encoded bits emitted at this step.";
            }
        }

        var inputText = response.input_text || "";
        if (text) {
            text.innerHTML = inputText.split("").map(function(character, index) {
                var label = character === " " ? "&nbsp;" : escapeHtml(character);
                var classes = ["interactive-source-char"];
                if (index === step.current_character_index) classes.push("is-active");
                if (index < step.current_character_index) classes.push("is-complete");
                return '<span class="' + classes.join(" ") + '">' + label + "</span>";
            }).join("");
        }

        if (currentChar) {
            currentChar.textContent = step.current_character === null || step.current_character === undefined
                ? "No active character"
                : 'Encoding "' + (step.current_character === " " ? "space" : step.current_character) + '"';
        }
    }

    function renderMeta(step, stepIndex, stepCount) {
        var title = document.getElementById("interactive-step-title");
        var description = document.getElementById("interactive-step-description");
        var counter = document.getElementById("interactive-step-counter");
        var counterBottom = document.getElementById("interactive-step-counter-bottom");
        var phase = document.getElementById("interactive-step-phase");

        if (title) title.textContent = step.title;
        if (description) description.textContent = step.description;
        if (counter) counter.textContent = "Step " + (stepIndex + 1) + " / " + stepCount;
        if (counterBottom) counterBottom.textContent = "Step " + (stepIndex + 1) + " / " + stepCount;
        if (phase) phase.textContent = String(step.phase || "trace").replace(/-/g, " ");
    }

    function revealWorkspace() {
        var workspace = document.getElementById("interactive-visualizer-workspace");
        if (workspace) workspace.hidden = false;
    }

    function applyPanelFocus(step) {
        var workspace = document.getElementById("interactive-visualizer-workspace");
        if (!workspace) return;
        workspace.classList.toggle("is-merge-focus", step.phase === "merge");
    }

    window.InteractiveUI = {
        toggleLayout: function(expand) {
            var wrapper = document.querySelector(".interactive-wrapper");
            if (!wrapper) return;

            var wasExpanded = wrapper.classList.contains("is-expanded");

            layoutExpanded = expand;
            wrapper.classList.toggle("is-expanded", expand);

            if (wasExpanded === expand) return;

            window.setTimeout(function() {
                if (window.InteractiveTree && typeof window.InteractiveTree.rerender === "function") {
                    window.InteractiveTree.rerender();
                }
            }, 450);
        },
        init: function() {
            renderFrequencyTable([]);
            renderCodes({});
            renderHeap([], []);
        },
        reset: function() {
            this.toggleLayout(false);

            var title = document.getElementById("interactive-step-title");
            var description = document.getElementById("interactive-step-description");
            var counter = document.getElementById("interactive-step-counter");
            var counterBottom = document.getElementById("interactive-step-counter-bottom");
            var phase = document.getElementById("interactive-step-phase");
            var bits = document.getElementById("interactive-encoded-bits");
            var text = document.getElementById("interactive-encoded-text");
            var currentChar = document.getElementById("interactive-current-char");
            var previousButton = document.getElementById("interactive-prev");
            var nextButton = document.getElementById("interactive-next");
            var resetButton = document.getElementById("interactive-reset");
            var input = document.getElementById("interactive-input");
            var compactBits = document.getElementById("interactive-compact-bits");

            if (title) title.textContent = "Ready";
            if (description) description.textContent = "Enter text to generate deterministic Huffman snapshots.";
            if (counter) counter.textContent = "Step 0 / 0";
            if (counterBottom) counterBottom.textContent = "Use the controls to move through the trace.";
            if (phase) phase.textContent = "trace";
            if (bits) bits.textContent = "";
            if (compactBits) {
                compactBits.textContent = "No bits emitted yet.";
                compactBits.classList.add("is-empty");
            }
            if (text) text.textContent = "";
            if (currentChar) currentChar.textContent = "No active character";
            if (previousButton) previousButton.disabled = true;
            if (nextButton) nextButton.disabled = true;
            if (resetButton) resetButton.hidden = true;

            renderFrequencyTable([]);
            renderCodes({});
            renderHeap([], []);
            applyPanelFocus({ phase: "" });

            window.requestAnimationFrame(function() {
                if (window.InteractiveTree && typeof window.InteractiveTree.rerender === "function") {
                    window.InteractiveTree.rerender();
                }
                if (input) input.focus();
            });
        },
        renderStep: function(step, response, stepIndex, stepCount) {
            revealWorkspace();
            renderMeta(step, stepIndex, stepCount);
            renderCode(step);
            renderHeap(step.heap_state || [], step.focus_nodes || []);
            renderFrequencyTable(step.frequency_table || []);
            renderCodes(step.codes || {});
            renderEncodedOutput(step, response);
            applyPanelFocus(step);
            this.toggleLayout(step.phase === "encode" || step.phase === "complete");

            if (window.InteractiveControls && typeof window.InteractiveControls.sync === "function") {
                window.InteractiveControls.sync(stepIndex, stepCount);
            }
        },
        showError: function(message) {
            var error = document.getElementById("interactive-error");
            if (error) {
                error.textContent = message;
                error.hidden = false;
            }
        },
        clearError: function() {
            var error = document.getElementById("interactive-error");
            if (error) {
                error.textContent = "";
                error.hidden = true;
            }
        },
        setBusy: function(isBusy) {
            var button = document.getElementById("interactive-encode");
            var status = document.getElementById("interactive-status");
            if (button) {
                button.disabled = isBusy;
                button.textContent = isBusy ? "Encoding..." : "Encode";
            }
            if (status) {
                status.textContent = isBusy ? "Building algorithm snapshots..." : "";
            }
        }
    };
})();
