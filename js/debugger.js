(function() {
    var codeLines = [
        "<span class='token-keyword'>def</span> <span class='token-function'>build_huffman</span>(text):",
        "    freq = {}",
        "    <span class='token-keyword'>for</span> ch <span class='token-keyword'>in</span> text:",
        "        freq[ch] = freq.get(ch, <span class='token-number'>0</span>) + <span class='token-number'>1</span>",
        "",
        "    heap = []",
        "    order = <span class='token-number'>0</span>",
        "    <span class='token-keyword'>for</span> ch, count <span class='token-keyword'>in</span> freq.items():",
        "        heappush(heap, (count, order, Node(ch, count)))",
        "        order += <span class='token-number'>1</span>",
        "",
        "    <span class='token-keyword'>while</span> len(heap) &gt; <span class='token-number'>1</span>:",
        "        left = heappop(heap).node",
        "        right = heappop(heap).node",
        "        parent = Node(left.label + right.label, left.freq + right.freq, left, right)",
        "        heappush(heap, (parent.freq, order, parent))",
        "        order += <span class='token-number'>1</span>",
        "",
        "    root = heap[<span class='token-number'>0</span>].node",
        "    codes = {}",
        "    assign_codes(root, <span class='token-string'>\"\"</span>, codes)",
        "    encoded_text = <span class='token-string'>\"\"</span>.join(codes[ch] <span class='token-keyword'>for</span> ch <span class='token-keyword'>in</span> text)",
        "    <span class='token-keyword'>return</span> root, codes, encoded_text"
    ];

    function leaf(id, label, freq) {
        return {
            id: id,
            label: label,
            freq: freq,
            left: null,
            right: null
        };
    }

    function parent(id, label, freq, left, right) {
        return {
            id: id,
            label: label,
            freq: freq,
            left: left,
            right: right
        };
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    var b = leaf("b", "b", 1);
    var a = leaf("a", "a", 1);
    var s = leaf("s", "s", 1);
    var k = leaf("k", "k", 1);
    var e = leaf("e", "e", 1);
    var t = leaf("t", "t", 1);

    var ba = parent("ba", "ba", 2, b, a);
    var sk = parent("sk", "sk", 2, s, k);
    var et = parent("et", "et", 2, e, t);
    var bask = parent("bask", "bask", 4, ba, sk);
    var basket = parent("basket", "basket", 6, et, bask);

    function heapItems(items) {
        return items.map(function(item) {
            return {
                id: item.id,
                label: item.label,
                freq: item.freq
            };
        });
    }

    function frequencyEntries(map) {
        return Object.keys(map).map(function(key) {
            return [key, map[key]];
        });
    }

    var states = [
        {
            step: 0,
            phase: "Introduction",
            title: "Initialize Input",
            explanation: "We begin with the text basket. This debugger will not execute live code; instead, each click renders a precomputed Huffman snapshot so you can inspect the algorithm deterministically.",
            highlightedLines: [1],
            inputText: "basket",
            encodedText: "",
            actionText: "Start with the input string and the high-level Huffman routine.",
            frequencyMap: {},
            heap: [],
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 1,
            phase: "Frequency Count",
            title: "Create the Frequency Map",
            explanation: "The first data structure is a frequency dictionary. It records how many times each character appears before we ever build a heap.",
            highlightedLines: [2, 3, 4],
            inputText: "basket",
            encodedText: "",
            actionText: "Initialize an empty frequency map and begin scanning the text.",
            frequencyMap: {},
            heap: [],
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 2,
            phase: "Frequency Count",
            title: "Scan the First Two Characters",
            explanation: "After reading b and a, both counts become 1. Because basket has no repeated letters, every count in this example will stay balanced.",
            highlightedLines: [3, 4],
            inputText: "basket",
            encodedText: "",
            actionText: "Update the table while moving through the text from left to right.",
            frequencyMap: { b: 1, a: 1 },
            heap: [],
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 3,
            phase: "Frequency Count",
            title: "Continue the Scan",
            explanation: "The next two letters s and k are added in the same way. Each step simply increments or initializes the matching dictionary entry.",
            highlightedLines: [3, 4],
            inputText: "basket",
            encodedText: "",
            actionText: "The scan is still just dictionary updates, one character at a time.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1 },
            heap: [],
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 4,
            phase: "Frequency Count",
            title: "Finish the Character Scan",
            explanation: "The final two letters e and t complete the table. We now know the weight that each leaf node will carry in the Huffman process.",
            highlightedLines: [3, 4],
            inputText: "basket",
            encodedText: "",
            actionText: "All six characters have now been counted exactly once.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: [],
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 5,
            phase: "Frequency Count",
            title: "Frequency Table Complete",
            explanation: "Every character has frequency 1. That means the heap will initially contain six equally weighted nodes, and our tie-breaking order will follow insertion order.",
            highlightedLines: [2, 3, 4],
            inputText: "basket",
            encodedText: "",
            actionText: "The completed frequency table becomes the input for heap construction.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: [],
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 6,
            phase: "Build Min Heap",
            title: "Initialize the Heap",
            explanation: "The min heap is the priority queue that keeps the lowest-frequency nodes ready for extraction. At this point, it exists but contains no nodes yet.",
            highlightedLines: [6, 7],
            inputText: "basket",
            encodedText: "",
            actionText: "Create an empty heap and a deterministic tie-breaking counter.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: [],
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 7,
            phase: "Build Min Heap",
            title: "Push the First Half of the Leaves",
            explanation: "We push leaf nodes for b, a, and s into the heap. Each heap entry stores frequency first so the smallest nodes are always removed first later.",
            highlightedLines: [8, 9, 10],
            inputText: "basket",
            encodedText: "",
            actionText: "Push leaf nodes into the priority queue using frequency as the primary key.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([b, a, s]),
            tree: [],
            encodingTable: {},
            activeNodes: ["b", "a", "s"],
            activeEdges: []
        },
        {
            step: 8,
            phase: "Build Min Heap",
            title: "Push the Remaining Leaves",
            explanation: "The heap now receives k, e, and t as well. Since every frequency is 1, the queue order follows the same stable insertion order we used while counting.",
            highlightedLines: [8, 9, 10],
            inputText: "basket",
            encodedText: "",
            actionText: "The heap is now populated with all six leaf nodes.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([b, a, s, k, e, t]),
            tree: [],
            encodingTable: {},
            activeNodes: ["k", "e", "t"],
            activeEdges: []
        },
        {
            step: 9,
            phase: "Build Min Heap",
            title: "Heap Ready for Merging",
            explanation: "At this stage the heap contains all candidate leaves. The main loop can now repeatedly pop the two smallest nodes and merge them into a parent.",
            highlightedLines: [12],
            inputText: "basket",
            encodedText: "",
            actionText: "The heap is ready; the next phase repeatedly extracts two minimum nodes.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([b, a, s, k, e, t]),
            tree: [],
            encodingTable: {},
            activeNodes: [],
            activeEdges: []
        },
        {
            step: 10,
            phase: "Build Huffman Tree",
            title: "Extract the First Two Minimum Nodes",
            explanation: "The first pop operations remove b and a. They leave the heap and move into the merge workspace, where they will become sibling leaves under a new parent.",
            highlightedLines: [12, 13, 14],
            inputText: "basket",
            encodedText: "",
            actionText: "Extract min node #1 and min node #2 from the heap.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([s, k, e, t]),
            tree: [clone(b), clone(a)],
            encodingTable: {},
            activeNodes: ["b", "a"],
            activeEdges: []
        },
        {
            step: 11,
            phase: "Build Huffman Tree",
            title: "Merge b and a into ba",
            explanation: "The new internal node ba gets frequency 2 because it represents both extracted leaves. This is the first visible piece of the Huffman tree.",
            highlightedLines: [15],
            inputText: "basket",
            encodedText: "",
            actionText: "Create a parent node whose frequency is the sum of its children.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([s, k, e, t]),
            tree: [clone(ba)],
            encodingTable: {},
            activeNodes: ["ba", "b", "a"],
            activeEdges: ["ba-b", "ba-a"]
        },
        {
            step: 12,
            phase: "Build Huffman Tree",
            title: "Push ba Back into the Heap",
            explanation: "After the merge, the parent node is reinserted into the min heap. This is what lets the algorithm keep combining partial trees until only one root remains.",
            highlightedLines: [16, 17],
            inputText: "basket",
            encodedText: "",
            actionText: "Push the merged subtree back into the priority queue.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([s, k, e, t, ba]),
            tree: [clone(ba)],
            encodingTable: {},
            activeNodes: ["ba"],
            activeEdges: []
        },
        {
            step: 13,
            phase: "Build Huffman Tree",
            title: "Merge s and k into sk",
            explanation: "The same rhythm repeats: extract two minimum leaves, create a parent, and push that parent back. Here the second subtree sk is formed.",
            highlightedLines: [12, 13, 14, 15, 16],
            inputText: "basket",
            encodedText: "",
            actionText: "Repeat the extraction and merge cycle on the next pair of minimum nodes.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([e, t, ba, sk]),
            tree: [clone(ba), clone(sk)],
            encodingTable: {},
            activeNodes: ["sk", "s", "k"],
            activeEdges: ["sk-s", "sk-k"]
        },
        {
            step: 14,
            phase: "Build Huffman Tree",
            title: "Merge e and t into et",
            explanation: "The third pair e and t becomes et. At this point the heap contains only merged subtrees, which means the algorithm is now combining larger structures instead of individual leaves.",
            highlightedLines: [12, 13, 14, 15, 16],
            inputText: "basket",
            encodedText: "",
            actionText: "The last pair of single leaves becomes a third internal subtree.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([ba, sk, et]),
            tree: [clone(ba), clone(sk), clone(et)],
            encodingTable: {},
            activeNodes: ["et", "e", "t"],
            activeEdges: ["et-e", "et-t"]
        },
        {
            step: 15,
            phase: "Build Huffman Tree",
            title: "Merge ba and sk into bask",
            explanation: "Now the heap extracts two internal nodes instead of leaves. Their merge creates a larger subtree bask with total frequency 4.",
            highlightedLines: [12, 13, 14, 15, 16],
            inputText: "basket",
            encodedText: "",
            actionText: "Internal subtrees now combine exactly like leaf nodes did earlier.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([et, bask]),
            tree: [clone(et), clone(bask)],
            encodingTable: {},
            activeNodes: ["bask", "ba", "sk"],
            activeEdges: ["bask-ba", "bask-sk"]
        },
        {
            step: 16,
            phase: "Build Huffman Tree",
            title: "Create the Final Root",
            explanation: "The last extraction removes et and bask. Merging them yields the final root basket with frequency 6, which equals the length of the full input string.",
            highlightedLines: [12, 13, 14, 15],
            inputText: "basket",
            encodedText: "",
            actionText: "The final merge creates a single root, so the heap process is complete.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: [],
            tree: [clone(basket)],
            encodingTable: {},
            activeNodes: ["basket", "et", "bask"],
            activeEdges: ["basket-et", "basket-bask"]
        },
        {
            step: 17,
            phase: "Build Huffman Tree",
            title: "Tree Construction Complete",
            explanation: "The heap now contains only one node conceptually, and that node is the Huffman root. The next phase walks this tree to assign 0 and 1 along each path.",
            highlightedLines: [19],
            inputText: "basket",
            encodedText: "",
            actionText: "A single root remains, so tree construction is done.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([basket]),
            tree: [clone(basket)],
            encodingTable: {},
            activeNodes: ["basket"],
            activeEdges: []
        },
        {
            step: 18,
            phase: "Generate Codes",
            title: "Start Traversing the Tree",
            explanation: "Code generation begins at the root. Moving left appends 0, and moving right appends 1. Leaves store the final binary code they collect along that path.",
            highlightedLines: [20, 21],
            inputText: "basket",
            encodedText: "",
            actionText: "Begin depth-first traversal from the root to each leaf.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([basket]),
            tree: [clone(basket)],
            encodingTable: {},
            activeNodes: ["basket"],
            activeEdges: []
        },
        {
            step: 19,
            phase: "Generate Codes",
            title: "Assign Codes in the Left Subtree",
            explanation: "The root's left child et is reached with 0. From there, e gets 00 and t gets 01 because the traversal goes left for e and right for t.",
            highlightedLines: [21],
            inputText: "basket",
            encodedText: "",
            actionText: "Walking left from the root adds 0 to every code in that subtree.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([basket]),
            tree: [clone(basket)],
            encodingTable: { e: "00", t: "01" },
            activeNodes: ["basket", "et", "e", "t"],
            activeEdges: ["basket-et", "et-e", "et-t"]
        },
        {
            step: 20,
            phase: "Generate Codes",
            title: "Assign Codes to b and a",
            explanation: "The right subtree begins with prefix 1. Inside bask, the ba subtree is reached by going left, so b and a receive 100 and 101.",
            highlightedLines: [21],
            inputText: "basket",
            encodedText: "",
            actionText: "Right from the root adds 1, then left into ba gives the next bit 0.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([basket]),
            tree: [clone(basket)],
            encodingTable: { e: "00", t: "01", b: "100", a: "101" },
            activeNodes: ["basket", "bask", "ba", "b", "a"],
            activeEdges: ["basket-bask", "bask-ba", "ba-b", "ba-a"]
        },
        {
            step: 21,
            phase: "Generate Codes",
            title: "Assign Codes to s and k",
            explanation: "The sk subtree is reached by going right from bask, so its leaves receive 110 and 111. With that, every leaf in the tree has a binary code.",
            highlightedLines: [21],
            inputText: "basket",
            encodedText: "",
            actionText: "The final two leaves complete the encoding table.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([basket]),
            tree: [clone(basket)],
            encodingTable: { e: "00", t: "01", b: "100", a: "101", s: "110", k: "111" },
            activeNodes: ["basket", "bask", "sk", "s", "k"],
            activeEdges: ["basket-bask", "bask-sk", "sk-s", "sk-k"]
        },
        {
            step: 22,
            phase: "Final Summary",
            title: "Encode the Original Text",
            explanation: "Replacing each character in basket with its Huffman code gives the final bitstring 1001011101110001. A naive fixed-width encoding would need 18 bits here, while Huffman uses 16.",
            highlightedLines: [22, 23],
            inputText: "basket",
            encodedText: "1001011101110001",
            actionText: "Use the completed encoding table to compress the original text.",
            frequencyMap: { b: 1, a: 1, s: 1, k: 1, e: 1, t: 1 },
            heap: heapItems([basket]),
            tree: [clone(basket)],
            encodingTable: { e: "00", t: "01", b: "100", a: "101", s: "110", k: "111" },
            activeNodes: ["basket"],
            activeEdges: []
        }
    ];

    function renderCode(highlightedLines) {
        var codeRoot = $("#debugger-code");
        codeRoot.empty();

        codeLines.forEach(function(line, index) {
            var lineNumber = index + 1;
            var isHighlighted = highlightedLines.indexOf(lineNumber) >= 0;
            var row = $("<div></div>")
                .addClass("debugger-code-line")
                .toggleClass("is-highlighted", isHighlighted)
                .toggleClass("is-muted", !isHighlighted && highlightedLines.length > 0);

            row.append($("<span></span>").addClass("debugger-code-line-number").text(lineNumber));
            row.append($("<span></span>").addClass("debugger-code-line-content").html(line || " "));
            codeRoot.append(row);
        });
    }

    function renderTable(rootId, entries, columns, emptyMessage) {
        var root = $(rootId);
        root.empty();

        if (!entries.length) {
            root.append($("<div></div>").addClass("heap-empty").text(emptyMessage));
            return;
        }

        var table = $("<table></table>").addClass("debugger-table");
        var header = $("<tr></tr>");
        columns.forEach(function(column) {
            header.append($("<th></th>").text(column));
        });
        table.append(header);

        entries.forEach(function(entry) {
            var row = $("<tr></tr>");
            entry.forEach(function(value) {
                row.append($("<td></td>").text(value));
            });
            table.append(row);
        });

        root.append(table);
    }

    function renderHeap(heap, activeNodes) {
        var root = $("#debugger-heap");
        root.empty();

        if (!heap.length) {
            root.append($("<div></div>").addClass("heap-empty").text("Heap is empty in this snapshot."));
            return;
        }

        heap.forEach(function(item) {
            var card = $("<div></div>")
                .addClass("heap-item")
                .toggleClass("is-active", activeNodes.indexOf(item.id) >= 0);

            card.append($("<span></span>").addClass("heap-item-label").text(item.label));
            card.append($("<span></span>").addClass("heap-item-weight").text(item.freq));
            root.append(card);
        });
    }

    function renderTree(forest, activeNodes, activeEdges) {
        var svg = d3.select("#debugger-tree-svg");
        svg.selectAll("*").remove();

        var width = $("#debugger-tree-svg").width();
        var height = $("#debugger-tree-svg").height();

        if (!forest.length) {
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height / 2)
                .attr("text-anchor", "middle")
                .style("font-family", "Roboto Mono, sans-serif")
                .style("font-size", "13px")
                .style("fill", "#7d8b9d")
                .text("Tree nodes appear here once heap merging begins.");
            return;
        }

        var laneWidth = width / forest.length;

        forest.forEach(function(rootNode, index) {
            var hierarchy = d3.hierarchy(rootNode, function(d) {
                var children = [];
                if (d.left) children.push(d.left);
                if (d.right) children.push(d.right);
                return children.length ? children : null;
            });

            var treeLayout = d3.tree().size([laneWidth - 80, height - 110]);
            treeLayout(hierarchy);

            var offsetX = index * laneWidth + 40;
            var offsetY = 30;

            var group = svg.append("g")
                .attr("transform", "translate(" + offsetX + "," + offsetY + ")");

            group.selectAll(".tree-link")
                .data(hierarchy.links())
                .enter()
                .append("path")
                .attr("class", function(d) {
                    var edgeId = d.source.data.id + "-" + d.target.data.id;
                    return "tree-link" + (activeEdges.indexOf(edgeId) >= 0 ? " is-active" : "");
                })
                .attr("d", function(d) {
                    var sourceX = d.source.x;
                    var sourceY = d.source.y;
                    var targetX = d.target.x;
                    var targetY = d.target.y;
                    var controlY = (sourceY + targetY) / 2;

                    return "M" + sourceX + "," + sourceY +
                        " C" + sourceX + "," + controlY +
                        " " + targetX + "," + controlY +
                        " " + targetX + "," + targetY;
                });

            var node = group.selectAll(".tree-node")
                .data(hierarchy.descendants())
                .enter()
                .append("g")
                .attr("class", function(d) {
                    var classes = ["tree-node"];
                    if (d.data.left || d.data.right) classes.push("is-internal");
                    if (activeNodes.indexOf(d.data.id) >= 0) classes.push("is-active");
                    return classes.join(" ");
                })
                .attr("transform", function(d) {
                    return "translate(" + d.x + "," + d.y + ")";
                });

            node.each(function(d) {
                var labelWidth = Math.max(46, d.data.label.length * 12 + 16);
                d.boxWidth = labelWidth;
            });

            node.append("rect")
                .attr("x", function(d) { return -d.boxWidth / 2; })
                .attr("y", -20)
                .attr("width", function(d) { return d.boxWidth; })
                .attr("height", 42);

            node.append("text")
                .attr("class", "tree-node-label")
                .attr("y", -3)
                .text(function(d) { return d.data.label; });

            node.append("text")
                .attr("class", "tree-node-freq")
                .attr("y", 12)
                .text(function(d) { return d.data.freq; });
        });
    }

    function renderState(state) {
        renderCode(state.highlightedLines);
        renderHeap(state.heap, state.activeNodes);
        renderTree(state.tree, state.activeNodes, state.activeEdges);

        renderTable("#debugger-frequency", frequencyEntries(state.frequencyMap), ["Char", "Freq"], "Frequency table will appear as characters are counted.");

        var encodingEntries = Object.keys(state.encodingTable).map(function(key) {
            return [key, state.encodingTable[key]];
        });
        renderTable("#debugger-encoding", encodingEntries, ["Char", "Code"], "Encoding table appears after the final tree is ready.");

        if (state.step === states.length - 1) {
            $("#debugger-encoding").append(
                $("<div></div>")
                    .addClass("debugger-summary-note")
                    .text("Naive fixed-width encoding: 18 bits. Huffman encoding: 16 bits.")
            );
        }

        $("#debugger-phase").text(state.phase);
        $("#debugger-progress").text("Step " + (state.step + 1) + " / " + states.length);
        $("#debugger-step-title").text(state.title);
        $("#debugger-step-explanation").text(state.explanation);
        $("#debugger-action-text").text(state.actionText);
        $("#debugger-input-text").text(state.inputText);
        $("#debugger-encoded-text").text(state.encodedText || "--");

        $("#debugger-prev").prop("disabled", state.step === 0);
        $("#debugger-next").prop("disabled", state.step === states.length - 1);

        if (typeof update_page_height === "function") update_page_height();
        if (typeof update_sticky_visual_state === "function") update_sticky_visual_state();
    }

    function initDebugger() {
        if (!$("#huffman-debugger").length) return;

        var currentStateIndex = 0;
        var debuggerRoot = $("#huffman-debugger");

        function goToState(index) {
            currentStateIndex = index;
            renderState(states[currentStateIndex]);
        }

        function focusDebugger() {
            debuggerRoot.trigger("focus");
        }

        function handleArrowNavigation(event) {
            if (event.key === "ArrowRight") {
                event.preventDefault();
                event.stopPropagation();
                if (currentStateIndex < states.length - 1) goToState(currentStateIndex + 1);
            } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                event.stopPropagation();
                if (currentStateIndex > 0) goToState(currentStateIndex - 1);
            }
        }

        $("#debugger-prev").on("click", function() {
            if (currentStateIndex > 0) goToState(currentStateIndex - 1);
        });

        $("#debugger-next").on("click", function() {
            if (currentStateIndex < states.length - 1) goToState(currentStateIndex + 1);
        });

        debuggerRoot.on("mousedown", function() {
            setTimeout(focusDebugger, 0);
        });

        $(document).on("mousedown.debuggerNavigation", function(event) {
            if ($(event.target).closest("#huffman-debugger").length) {
                setTimeout(focusDebugger, 0);
            }
        });

        debuggerRoot.on("keydown.debuggerNavigation", function(event) {
            handleArrowNavigation(event);
        });

        goToState(0);
    }

    $(document).ready(initDebugger);
})();
