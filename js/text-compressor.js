(function() {
    var PRUNE_NODE_THRESHOLD = 31;
    var PRUNE_DEPTH = 5;

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function setText(id, value) {
        var element = byId(id);
        if (element) element.textContent = value;
    }

    function formatBytes(value) {
        var bytes = Number(value || 0);
        if (bytes < 1024) return bytes + " B";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
        return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    function formatPercent(value) {
        return Number(value || 0).toFixed(2) + "%";
    }

    function formatNumber(value) {
        return Number(value || 0).toFixed(3);
    }

    function countNodes(node) {
        if (!node) return 0;
        return 1 + (node.children || []).reduce(function(total, child) {
            return total + countNodes(child);
        }, 0);
    }

    function pruneTree(node, shouldPrune, depth) {
        if (!node) return null;
        var copy = {
            id: node.id,
            label: node.label,
            frequency: node.frequency,
            type: node.type,
            edge: node.edge
        };

        if (shouldPrune && depth >= PRUNE_DEPTH && node.children && node.children.length) {
            copy.children = [{
                id: node.id + "-pruned",
                label: "...",
                frequency: node.frequency,
                type: "leaf",
                edge: "*"
            }];
            return copy;
        }

        if (node.children && node.children.length) {
            copy.children = node.children.map(function(child) {
                return pruneTree(child, shouldPrune, depth + 1);
            });
        }

        return copy;
    }

    function base64ToBlob(base64) {
        var binary = window.atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return new Blob([bytes], { type: "application/octet-stream" });
    }

    var IDE_COMPRESSOR = {
        payload: null,
        steps: [],
        currentStep: -1,
        downloadUrl: null,
        resizeObserver: null,
        frequencyChart: null,
        activeTab: "tree",
        bitstreamExpanded: false,
        highlightedCode: null,
        highlightedByte: null,

        init: function() {
            var form = byId("tc-upload-form");
            var fileInput = byId("tc-file-input");
            var host = byId("tc-tree-host");
            var tabs = document.querySelectorAll("[data-tc-tab]");
            var more = byId("tc-bitstream-more");

            if (form) {
                form.addEventListener("submit", function(event) {
                    event.preventDefault();
                    IDE_COMPRESSOR.submitFile(fileInput && fileInput.files ? fileInput.files[0] : null);
                });
            }

            tabs.forEach(function(tab) {
                tab.addEventListener("click", function() {
                    IDE_COMPRESSOR.switchTab(tab.getAttribute("data-tc-tab"));
                });
            });

            if (more) {
                more.addEventListener("click", function() {
                    IDE_COMPRESSOR.bitstreamExpanded = !IDE_COMPRESSOR.bitstreamExpanded;
                    IDE_COMPRESSOR.renderBitstreamInteractive();
                });
            }

            if (host && window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(function() {
                    IDE_COMPRESSOR.renderState();
                });
                this.resizeObserver.observe(host);
            }

            this.updateDashboard({});
            this.renderState();
        },

        switchTab: function(tabName) {
            this.activeTab = tabName;
            document.querySelectorAll("[data-tc-tab]").forEach(function(tab) {
                tab.classList.toggle("is-active", tab.getAttribute("data-tc-tab") === tabName);
            });
            document.querySelectorAll("[data-tc-panel]").forEach(function(panel) {
                panel.classList.toggle("is-active", panel.getAttribute("data-tc-panel") === tabName);
            });
            if (tabName === "tree") this.renderState();
            if (tabName === "chart" && this.payload) this.renderFrequencyChart(this.payload.frequency_table || this.payload.top_10_freqs || []);
            if (tabName === "bitstream" && this.payload) this.renderBitstreamInteractive();
        },

        setBusy: function(isBusy) {
            var button = byId("tc-compress-button");
            if (button) {
                button.disabled = isBusy;
                button.textContent = isBusy ? "Compressing..." : "Compress";
            }
            setText("tc-status", isBusy ? "Processing file..." : "Ready.");
        },

        showError: function(message) {
            var error = byId("tc-error");
            if (!error) return;
            error.textContent = message;
            error.hidden = false;
        },

        clearError: function() {
            var error = byId("tc-error");
            if (!error) return;
            error.textContent = "";
            error.hidden = true;
        },

        submitFile: function(file) {
            if (!file) {
                this.showError("Choose a .txt file before compressing.");
                return;
            }

            var formData = new FormData();
            formData.append("file", file, file.name);

            this.clearError();
            this.resetDownload();
            this.setBusy(true);

            fetch("/compress_file", {
                method: "POST",
                body: formData
            })
                .then(function(response) {
                    if (!response.ok) {
                        return response.json().then(function(payload) {
                            throw new Error(payload.error || "Compression failed.");
                        });
                    }
                    return response.json();
                })
                .then(function(payload) {
                    IDE_COMPRESSOR.payload = payload;
                    IDE_COMPRESSOR.steps = payload.steps || [];
                    IDE_COMPRESSOR.currentStep = IDE_COMPRESSOR.steps.length ? IDE_COMPRESSOR.steps.length - 1 : -1;
                    IDE_COMPRESSOR.updateAnalyticsDashboard(payload);
                    IDE_COMPRESSOR.updateTables(payload);
                    IDE_COMPRESSOR.renderFrequencyChart(payload.frequency_table || payload.top_10_freqs || []);
                    IDE_COMPRESSOR.bitstreamExpanded = false;
                    IDE_COMPRESSOR.renderBitstreamInteractive();
                    IDE_COMPRESSOR.updateDownload(payload);
                    IDE_COMPRESSOR.renderState();
                })
                .catch(function(error) {
                    IDE_COMPRESSOR.showError(error.message || "Unable to reach the compressor backend.");
                })
                .finally(function() {
                    IDE_COMPRESSOR.setBusy(false);
                });
        },

        updateDashboard: function(metrics) {
            setText("tc-original-size", metrics.original_size === undefined ? "--" : formatBytes(metrics.original_size));
            setText("tc-compressed-size", metrics.compressed_size === undefined ? "--" : formatBytes(metrics.compressed_size));
            setText("tc-entropy", metrics.entropy === undefined ? "--" : formatNumber(metrics.entropy));
            setText("tc-efficiency", metrics.efficiency === undefined ? "--" : formatPercent(metrics.efficiency * 100));
            setText("tc-ratio-value", metrics.compression_ratio_percent === undefined ? "--" : formatPercent(metrics.compression_ratio_percent));
            setText("tc-redundancy", metrics.redundancy === undefined ? "--" : formatNumber(metrics.redundancy));
            setText("tc-integrity", "Integrity: " + (metrics.verified ? "Verified" : "pending"));

            var fill = byId("tc-ratio-fill");
            if (fill) {
                var ratio = Math.max(0, Math.min(100, Number(metrics.compression_ratio_percent || 0)));
                fill.style.width = ratio + "%";
            }

            this.renderInsights(this.get_compression_insights(metrics.entropy, metrics.compression_ratio_percent, metrics.skew));
        },

        updateAnalyticsDashboard: function(data) {
            var metrics = data.metrics || data.stats || {};
            this.updateDashboard(metrics);
            this.renderMetadataBreakdown(data.metadata_breakdown || {});
            this.renderComparisonChart(data.comparison || {});
            this.renderInsights((data.dynamic_insights && data.dynamic_insights.length)
                ? data.dynamic_insights
                : this.get_compression_insights(metrics.entropy, metrics.compression_ratio_percent, metrics.skew));
        },

        renderMetadataBreakdown: function(metadata) {
            setText("tc-payload-size", metadata.payload_size_bytes === undefined ? "--" : formatBytes(metadata.payload_size_bytes));
            setText("tc-header-size", metadata.header_size_bytes === undefined ? "--" : formatBytes(metadata.header_size_bytes));
            setText("tc-padding-size", metadata.padding_bits === undefined ? "--" : metadata.padding_bits + " bits");
        },

        renderComparisonChart: function(comparison) {
            var root = byId("tc-comparison-chart");
            if (!root) return;

            var rows = [
                { label: "Fixed 8-bit ASCII", value: Number(comparison.fixed_ascii_bits || 0), className: "is-ascii" },
                { label: "Huffman Payload", value: Number(comparison.huffman_bits || 0), className: "is-huffman" },
                { label: ".huff File Total", value: Number(comparison.packed_file_bits || 0), className: "is-total" }
            ];
            var max = rows.reduce(function(current, row) {
                return Math.max(current, row.value);
            }, 1);

            if (window.d3) {
                root.innerHTML = "";
                var selection = d3.select(root)
                    .selectAll(".tc-comparison-row")
                    .data(rows)
                    .enter()
                    .append("div")
                    .attr("class", function(row) { return "tc-comparison-row " + row.className; });

                selection.append("span").text(function(row) { return row.label; });
                selection.append("div")
                    .attr("class", "tc-comparison-track")
                    .append("i")
                    .style("width", function(row) { return Math.max(2, (row.value / max) * 100) + "%"; });
                selection.append("strong").text(function(row) { return row.value.toLocaleString() + " bits"; });
                return;
            }

            root.innerHTML = rows.map(function(row) {
                var width = Math.max(2, (row.value / max) * 100);
                return [
                    '<div class="tc-comparison-row ' + row.className + '">',
                    '<span>' + escapeHtml(row.label) + "</span>",
                    '<div class="tc-comparison-track"><i style="width:' + width + '%"></i></div>',
                    '<strong>' + escapeHtml(row.value.toLocaleString()) + " bits</strong>",
                    "</div>"
                ].join("");
            }).join("");
        },

        get_compression_insights: function(entropy, ratio, skew) {
            var insights = [];
            entropy = Number(entropy || 0);
            ratio = Number(ratio || 0);
            skew = Number(skew || 0);

            if (!entropy && !ratio && !skew) return ["No analysis yet."];
            if (skew >= 0.35) insights.push("High symbol skew detected; this file is a strong Huffman candidate.");
            if (ratio < 75) insights.push("Compression ratio is favorable; encoded payload is materially smaller than input.");
            if (ratio >= 100) insights.push("Header overhead exceeds savings for this file size or distribution.");
            if (entropy < 4) insights.push("Low entropy indicates repeated structure and high redundancy.");
            if (entropy >= 7) insights.push("High entropy distribution leaves limited room for prefix-code compression.");
            return insights.length ? insights : ["Balanced distribution detected; compression gains depend on file size."];
        },

        renderInsights: function(insights) {
            var root = byId("tc-insights");
            if (!root) return;
            root.innerHTML = insights.map(function(insight) {
                return "<li>" + escapeHtml(insight) + "</li>";
            }).join("");
        },

        updateTables: function(payload) {
            var frequencyBody = byId("tc-frequency-body");
            var codeBody = byId("tc-code-body");
            var frequencies = payload.top_10_freqs || [];
            var codes = payload.codes || {};

            if (frequencyBody) {
                frequencyBody.innerHTML = frequencies.length
                    ? frequencies.map(function(item) {
                        return [
                            "<tr>",
                            "<td>" + escapeHtml(item.label) + "</td>",
                            "<td>" + escapeHtml(item.frequency) + "</td>",
                            "<td>" + escapeHtml(formatPercent(item.share_percent)) + "</td>",
                            "</tr>"
                        ].join("");
                    }).join("")
                    : '<tr><td colspan="3">No frequency data.</td></tr>';
            }

            if (codeBody) {
                var rows = Object.keys(codes).sort(function(left, right) {
                    return Number(left) - Number(right);
                });
                codeBody.innerHTML = rows.length
                    ? rows.map(function(byteValue) {
                        var label = payload.labels && payload.labels[byteValue] ? payload.labels[byteValue] : byteValue;
                        return [
                            '<tr data-tc-code-byte="' + escapeHtml(byteValue) + '" data-tc-code="' + escapeHtml(codes[byteValue]) + '">',
                            "<td>" + escapeHtml(label) + "</td>",
                            "<td><code>" + escapeHtml(codes[byteValue]) + "</code></td>",
                            "</tr>"
                        ].join("");
                    }).join("")
                    : '<tr><td colspan="2">No codes generated.</td></tr>';
                this.attachCodeTableEvents();
            }
        },

        attachCodeTableEvents: function() {
            var self = this;
            document.querySelectorAll("[data-tc-code-byte]").forEach(function(row) {
                row.addEventListener("mouseenter", function(event) {
                    var target = event.currentTarget;
                    self.highlightSymbolBits(target.getAttribute("data-tc-code-byte"), target.getAttribute("data-tc-code"));
                    target.classList.add("is-linked");
                });
                row.addEventListener("mouseleave", function(event) {
                    event.currentTarget.classList.remove("is-linked");
                    self.clearBitMapping();
                });
            });
        },

        renderFrequencyChart: function(frequencies) {
            var bars = byId("tc-frequency-bars");
            var canvas = byId("tc-frequency-chart");
            frequencies = (frequencies || []).slice(0, 20);

            if (window.Chart && canvas) {
                canvas.hidden = false;
                if (this.frequencyChart) this.frequencyChart.destroy();
                this.frequencyChart = new Chart(canvas, {
                    type: "bar",
                    data: {
                        labels: frequencies.map(function(item) { return item.label; }),
                        datasets: [{
                            label: "Frequency",
                            data: frequencies.map(function(item) { return item.frequency; }),
                            backgroundColor: "#50beaa"
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            x: { ticks: { color: "#8b949e" } },
                            y: { ticks: { color: "#8b949e" } }
                        },
                        plugins: {
                            legend: { labels: { color: "#e6edf3" } }
                        }
                    }
                });
                if (bars) bars.innerHTML = "";
                return;
            }

            if (canvas) {
                canvas.hidden = true;
            }

            if (!bars) return;
            var maxFrequency = frequencies.reduce(function(max, item) {
                return Math.max(max, item.frequency);
            }, 1);
            bars.innerHTML = frequencies.length
                ? frequencies.map(function(item) {
                    var width = Math.max(2, (item.frequency / maxFrequency) * 100);
                    return [
                        '<div class="tc-frequency-bar-row">',
                        '<span>' + escapeHtml(item.label) + "</span>",
                        '<div class="tc-frequency-bar-track"><i style="width:' + width + '%"></i></div>',
                        '<strong>' + escapeHtml(item.frequency) + "</strong>",
                        "</div>"
                    ].join("");
                }).join("")
                : '<div class="tc-muted">No frequency data.</div>';
        },

        renderBitstreamInteractive: function() {
            var root = byId("tc-bitstream-peek");
            var more = byId("tc-bitstream-more");
            if (!root) return;

            var diagnostics = this.payload && this.payload.bitstream_diagnostics;
            if (!diagnostics || !diagnostics.preview_bits) {
                root.textContent = "No bitstream generated.";
                if (more) more.hidden = true;
                setText("tc-bit-payload-count", "--");
                setText("tc-bit-padding-count", "--");
                setText("tc-bit-total-bytes", "--");
                return;
            }

            var renderLimit = this.bitstreamExpanded ? diagnostics.preview_bits.length : Math.min(256, diagnostics.preview_bits.length);
            var bits = diagnostics.preview_bits.slice(0, renderLimit);
            var headerBits = diagnostics.header_preview_bits || "";
            var html = "";

            setText("tc-bit-payload-count", diagnostics.payload_bit_count + " bits");
            setText("tc-bit-padding-count", diagnostics.padding_bits + " bits");
            setText("tc-bit-total-bytes", diagnostics.total_bytes + " bytes");
            this.renderBeforeAfterBits(diagnostics, bits);

            if (headerBits) {
                html += '<div class="tc-byte-container tc-byte-container-header" title="JSON header preview">';
                html += '<span class="tc-byte-label">JSON header: ' + escapeHtml(diagnostics.header_bit_count) + " bits</span>";
                html += this.renderByteGroups(headerBits, {
                    className: "tc-bitstream-bit is-header",
                    dataOffset: -headerBits.length
                });
                html += "</div>";
            }

            html += '<div class="tc-payload-stream">';
            html += this.renderByteGroups(bits, {
                diagnostics: diagnostics,
                dataOffset: 0
            });
            html += "</div>";

            root.innerHTML = html;
            this.attachBitstreamEvents(root, diagnostics);

            if (more) {
                more.hidden = diagnostics.preview_bits.length <= 256;
                more.textContent = this.bitstreamExpanded ? "Show less" : "Show more";
            }
        },

        renderBeforeAfterBits: function(diagnostics, huffmanBits) {
            var ascii = byId("tc-ascii-preview");
            var huffman = byId("tc-huffman-preview");
            if (ascii) {
                ascii.innerHTML = this.renderCompactBits(diagnostics.ascii_preview_bits || "", "tc-fixed-bit");
            }
            if (huffman) {
                huffman.innerHTML = this.renderCompactBits(huffmanBits || "", "tc-huffman-bit");
            }
        },

        renderCompactBits: function(bits, className) {
            if (!bits) return "No preview.";
            var chunks = [];
            for (var index = 0; index < Math.min(bits.length, 96); index += 8) {
                chunks.push('<span class="tc-mini-byte ' + className + '">' + escapeHtml(bits.slice(index, index + 8)) + "</span>");
            }
            return chunks.join("");
        },

        renderByteGroups: function(bits, options) {
            options = options || {};
            var diagnostics = options.diagnostics || {};
            var chunks = [];
            var visibleDataBits = Number(diagnostics.visible_data_bits || bits.length);

            for (var offset = 0; offset < bits.length; offset += 8) {
                var byteBits = bits.slice(offset, offset + 8);
                var bitHtml = byteBits.split("").map(function(bit, bitOffset) {
                    var bitIndex = offset + bitOffset + (options.dataOffset || 0);
                    var mapping = diagnostics.bit_to_symbol ? diagnostics.bit_to_symbol[String(bitIndex)] : null;
                    var classes = [options.className || "tc-bitstream-bit"];

                    if (diagnostics.visible_padding_bits && bitIndex >= visibleDataBits) {
                        classes.push("is-padding");
                    }

                    return [
                        '<span class="' + classes.join(" ") + '"',
                        mapping ? ' data-bit-index="' + bitIndex + '" data-code="' + escapeHtml(mapping.code) + '" data-byte="' + escapeHtml(mapping.byte) + '" data-symbol="' + escapeHtml(mapping.symbol) + '" data-start="' + escapeHtml(mapping.start) + '"' : "",
                        ">",
                        escapeHtml(bit),
                        "</span>"
                    ].join("");
                }).join("");

                chunks.push('<span class="tc-byte-container tc-bitstream-chunk">' + bitHtml + "</span>");
            }

            return chunks.join("");
        },

        attachBitstreamEvents: function(root, diagnostics) {
            var tooltip = this.ensureBitTooltip();
            var self = this;

            root.querySelectorAll("[data-code]").forEach(function(bit) {
                bit.addEventListener("mouseenter", function(event) {
                    var target = event.currentTarget;
                    var code = target.getAttribute("data-code");
                    var byteValue = target.getAttribute("data-byte");
                    var symbol = target.getAttribute("data-symbol");
                    var start = target.getAttribute("data-start");
                    self.highlightBitMapping(code, byteValue, start);
                    tooltip.textContent = 'Symbol: "' + symbol + '" | Code: "' + code + '" | Bits: ' + code.length;
                    tooltip.hidden = false;
                });

                bit.addEventListener("mousemove", function(event) {
                    tooltip.style.left = event.clientX + 14 + "px";
                    tooltip.style.top = event.clientY + 14 + "px";
                });

                bit.addEventListener("mouseleave", function() {
                    self.clearBitMapping();
                    tooltip.hidden = true;
                });
            });
        },

        ensureBitTooltip: function() {
            var tooltip = byId("tc-bit-tooltip");
            if (tooltip) return tooltip;
            tooltip = document.createElement("div");
            tooltip.id = "tc-bit-tooltip";
            tooltip.className = "tc-bit-tooltip";
            tooltip.hidden = true;
            document.body.appendChild(tooltip);
            return tooltip;
        },

        highlightBitMapping: function(code, byteValue, start) {
            this.highlightedCode = code;
            this.highlightedByte = byteValue;

            document.querySelectorAll(".tc-bitstream-bit.is-active").forEach(function(bit) {
                bit.classList.remove("is-active");
            });
            document.querySelectorAll('.tc-bitstream-bit[data-start="' + start + '"]').forEach(function(bit) {
                bit.classList.add("is-active");
            });

            document.querySelectorAll("[data-tc-code-byte]").forEach(function(row) {
                row.classList.toggle("is-linked", row.getAttribute("data-tc-code-byte") === String(byteValue));
            });

            this.renderState();
        },

        highlightSymbolBits: function(byteValue, code) {
            this.highlightedCode = code;
            this.highlightedByte = byteValue;

            document.querySelectorAll(".tc-bitstream-bit.is-active").forEach(function(bit) {
                bit.classList.remove("is-active");
            });
            document.querySelectorAll('.tc-bitstream-bit[data-byte="' + String(byteValue) + '"]').forEach(function(bit) {
                bit.classList.add("is-active");
            });

            this.renderState();
        },

        clearBitMapping: function() {
            this.highlightedCode = null;
            this.highlightedByte = null;
            document.querySelectorAll(".tc-bitstream-bit.is-active").forEach(function(bit) {
                bit.classList.remove("is-active");
            });
            document.querySelectorAll("[data-tc-code-byte].is-linked").forEach(function(row) {
                row.classList.remove("is-linked");
            });
            this.renderState();
        },

        resetDownload: function() {
            if (this.downloadUrl) {
                URL.revokeObjectURL(this.downloadUrl);
                this.downloadUrl = null;
            }

            var link = byId("tc-download");
            if (link) {
                link.href = "#";
                link.removeAttribute("download");
                link.classList.add("is-disabled");
                link.setAttribute("aria-disabled", "true");
            }
        },

        updateDownload: function(payload) {
            this.resetDownload();
            var link = byId("tc-download");
            if (!link || !payload.compressed_file_base64) return;

            this.downloadUrl = URL.createObjectURL(base64ToBlob(payload.compressed_file_base64));
            link.href = this.downloadUrl;
            link.download = payload.compressed_filename || "compressed.huff";
            link.classList.remove("is-disabled");
            link.setAttribute("aria-disabled", "false");
        },

        getVisibleTree: function() {
            return this.payload ? (this.payload.visual_tree_data || this.payload.tree_data) : null;
        },

        renderState: function() {
            var svgElement = byId("tc-tree-svg");
            var host = byId("tc-tree-host");
            if (!svgElement || !host || !window.d3) return;

            var svg = d3.select(svgElement);
            svg.selectAll("*").remove();

            var width = Math.max(640, host.clientWidth || 640);
            var height = Math.max(420, host.clientHeight || 420);
            svg.attr("width", width).attr("height", height).attr("viewBox", "0 0 " + width + " " + height);

            var treeData = this.getVisibleTree();
            if (!treeData) {
                svg.append("text")
                    .attr("class", "tc-tree-empty")
                    .attr("x", width / 2)
                    .attr("y", height / 2)
                    .attr("text-anchor", "middle")
                    .text("Compress a file to render its Huffman tree.");
                return;
            }

            var shouldPrune = countNodes(treeData) > PRUNE_NODE_THRESHOLD;
            var visibleTree = pruneTree(treeData, shouldPrune, 0);
            var root = d3.hierarchy(visibleTree);
            var highlightedPath = {};
            if (this.highlightedCode) {
                this.findPathForCode(visibleTree, this.highlightedCode).forEach(function(id) {
                    highlightedPath[id] = true;
                });
            }
            var treeLayout = d3.tree().nodeSize([54, 96]);
            treeLayout(root);

            var nodes = root.descendants();
            var links = root.links();
            var minX = d3.min(nodes, function(node) { return node.x; }) || 0;
            var maxX = d3.max(nodes, function(node) { return node.x; }) || 0;
            var minY = d3.min(nodes, function(node) { return node.y; }) || 0;
            var offsetX = (width - (maxX - minX)) / 2 - minX;
            var offsetY = 42 - minY;

            var layer = svg.append("g").attr("class", "tc-tree-layer");
            var zoom = d3.zoom()
                .scaleExtent([0.25, 4])
                .on("zoom", function() {
                    layer.attr("transform", d3.event.transform);
                });
            svg.call(zoom);

            layer.selectAll(".tc-tree-link")
                .data(links)
                .enter()
                .append("path")
                .attr("class", function(link) {
                    return highlightedPath[link.source.data.id] && highlightedPath[link.target.data.id]
                        ? "tc-tree-link is-active"
                        : "tc-tree-link";
                })
                .attr("d", function(link) {
                    var sourceX = link.source.x + offsetX;
                    var sourceY = link.source.y + offsetY;
                    var targetX = link.target.x + offsetX;
                    var targetY = link.target.y + offsetY;
                    var midY = (sourceY + targetY) / 2;
                    return "M" + sourceX + "," + sourceY + "C" + sourceX + "," + midY + " " + targetX + "," + midY + " " + targetX + "," + targetY;
                });

            layer.selectAll(".tc-tree-edge-label")
                .data(links)
                .enter()
                .append("text")
                .attr("class", "tc-tree-edge-label")
                .attr("x", function(link) { return (link.source.x + link.target.x) / 2 + offsetX; })
                .attr("y", function(link) { return (link.source.y + link.target.y) / 2 + offsetY - 8; })
                .attr("text-anchor", "middle")
                .text(function(link) { return link.target.data.edge || ""; });

            var node = layer.selectAll(".tc-tree-node")
                .data(nodes)
                .enter()
                .append("g")
                .attr("class", function(datum) {
                    return "tc-tree-node " + (datum.data.type === "internal" ? "is-internal" : "is-leaf") + (highlightedPath[datum.data.id] ? " is-active" : "");
                })
                .attr("transform", function(datum) {
                    return "translate(" + (datum.x + offsetX) + "," + (datum.y + offsetY) + ")";
                });

            node.append("circle").attr("r", 20);
            node.append("text")
                .attr("class", "tc-tree-node-label")
                .attr("y", 4)
                .attr("text-anchor", "middle")
                .text(function(datum) {
                    return datum.data.type === "internal" ? datum.data.frequency : datum.data.label;
                });
        },

        findPathForCode: function(treeData, code) {
            var path = [];
            var node = treeData;
            if (!node) return path;
            path.push(node.id);

            for (var index = 0; index < code.length; index += 1) {
                var edge = code[index];
                var next = (node.children || []).filter(function(child) {
                    return child.edge === edge;
                })[0];
                if (!next) return [];
                node = next;
                path.push(node.id);
            }

            return path;
        }
    };

    window.IDE_COMPRESSOR = IDE_COMPRESSOR;
    document.addEventListener("DOMContentLoaded", function() {
        IDE_COMPRESSOR.init();
    });
})();
