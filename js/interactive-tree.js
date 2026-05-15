(function() {
    var DURATION = 450;
    var EASE = d3.easeCubicInOut;
    var stage = {
        svg: null,
        layer: null,
        empty: null,
        zoom: null,
        resizeObserver: null,
        positions: {}
    };

    function ensureStage() {
        if (!stage.svg) {
            stage.svg = d3.select("#interactive-tree-svg");
            stage.layer = stage.svg.append("g").attr("class", "interactive-tree-layer");
            stage.empty = stage.svg.append("text")
                .attr("class", "interactive-tree-empty")
                .attr("text-anchor", "middle");
            stage.zoom = d3.zoom()
                .scaleExtent([0.35, 3])
                .on("zoom", function() {
                    stage.layer.attr("transform", d3.event.transform);
                });
            stage.svg.call(stage.zoom);
        }
        return stage;
    }

    function treeChildren(node) {
        return node && node.children && node.children.length ? node.children : null;
    }

    function renderEmpty(width, height) {
        var currentStage = ensureStage();
        currentStage.layer.selectAll("*").remove();
        currentStage.empty
            .attr("x", width / 2)
            .attr("y", height / 2)
            .style("opacity", 1)
            .text("The Huffman tree will appear once heap merges begin.");
        stage.positions = {};
    }

    function flattenForest(forest, width, height) {
        var laneWidth = width / Math.max(forest.length, 1);
        var nodes = [];
        var links = [];
        var edgeLabels = [];

        forest.forEach(function(treeRoot, index) {
            var hierarchy = d3.hierarchy(treeRoot, treeChildren);
            var horizontalPadding = 72;
            var topOffset = 30;
            var verticalPadding = 56;
            var horizontalSpace = Math.max(160, laneWidth - (horizontalPadding * 2));
            var verticalSpace = Math.max(220, height - topOffset - verticalPadding);

            d3.tree().size([horizontalSpace, verticalSpace])(hierarchy);

            var offsetX = index * laneWidth + horizontalPadding;

            hierarchy.descendants().forEach(function(node) {
                nodes.push({
                    id: node.data.id,
                    label: node.data.label,
                    frequency: node.data.frequency,
                    isInternal: node.data.type === "internal",
                    x: node.x + offsetX,
                    y: node.y + topOffset,
                    parentId: node.parent ? node.parent.data.id : null
                });
            });

            hierarchy.links().forEach(function(link) {
                var sourceX = link.source.x + offsetX;
                var sourceY = link.source.y + topOffset;
                var targetX = link.target.x + offsetX;
                var targetY = link.target.y + topOffset;
                var edgeId = link.source.data.id + "-" + link.target.data.id;

                links.push({
                    id: edgeId,
                    sourceId: link.source.data.id,
                    targetId: link.target.data.id,
                    sourceX: sourceX,
                    sourceY: sourceY,
                    targetX: targetX,
                    targetY: targetY
                });

                edgeLabels.push({
                    id: edgeId + "-label",
                    label: link.target.data.edge || "",
                    x: (sourceX + targetX) / 2,
                    y: (sourceY + targetY) / 2 - 8
                });
            });
        });

        return {
            nodes: nodes,
            links: links,
            edgeLabels: edgeLabels
        };
    }

    function endpointOutsideNode(fromX, fromY, toX, toY) {
        var nodeRadius = 20;
        var dx = toX - fromX;
        var dy = toY - fromY;
        var length = Math.sqrt(dx * dx + dy * dy) || 1;

        return {
            x: toX - (dx / length) * nodeRadius,
            y: toY - (dy / length) * nodeRadius
        };
    }

    function pathFor(link) {
        var source = endpointOutsideNode(link.targetX, link.targetY, link.sourceX, link.sourceY);
        var target = endpointOutsideNode(link.sourceX, link.sourceY, link.targetX, link.targetY);
        var controlY = (source.y + target.y) / 2;

        return "M" + source.x + "," + source.y +
            "C" + source.x + "," + controlY +
            " " + target.x + "," + controlY +
            " " + target.x + "," + target.y;
    }

    function previousPosition(node) {
        if (stage.positions[node.id]) return stage.positions[node.id];
        if (node.parentId && stage.positions[node.parentId]) return stage.positions[node.parentId];
        return { x: node.x, y: node.y };
    }

    function renderForest(step) {
        var currentStage = ensureStage();
        var host = document.getElementById("tree-viz") || document.getElementById("interactive-tree-svg");
        if (!host) return;

        var rect = host.getBoundingClientRect();
        var width = Math.max(1, rect.width || host.clientWidth || 1);
        var height = Math.max(1, rect.height || host.clientHeight || 1);

        currentStage.svg
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", "0 0 " + width + " " + height);

        var forest = ((step.tree || {}).children || []).slice();
        if (!forest.length) {
            renderEmpty(width, height);
            return;
        }

        currentStage.empty.style("opacity", 0);

        var layout = flattenForest(forest, width, height);
        var nextPositions = {};
        var focusLookup = {};
        (step.focus_nodes || []).forEach(function(id) {
            focusLookup[id] = true;
        });

        layout.nodes.forEach(function(node) {
            nextPositions[node.id] = { x: node.x, y: node.y };
        });

        var transition = d3.transition().duration(DURATION).ease(EASE);

        var links = currentStage.layer.selectAll(".interactive-tree-link")
            .data(layout.links, function(d) { return d.id; });

        links.exit()
            .transition(transition)
            .style("opacity", 0)
            .remove();

        var enteredLinks = links.enter()
            .append("path")
            .attr("class", "interactive-tree-link")
            .style("opacity", 0.35)
            .attr("d", function(d) {
                var origin = stage.positions[d.sourceId] || { x: d.sourceX, y: d.sourceY };
                return "M" + origin.x + "," + origin.y +
                    "C" + origin.x + "," + origin.y +
                    " " + origin.x + "," + origin.y +
                    " " + origin.x + "," + origin.y;
            });

        links = enteredLinks.merge(links);
        links
            .classed("is-focused", function(d) {
                return !!focusLookup[d.sourceId] || !!focusLookup[d.targetId];
            })
            .transition(transition)
            .style("opacity", 1)
            .attr("d", pathFor);

        var edgeLabels = currentStage.layer.selectAll(".interactive-tree-edge-label")
            .data(layout.edgeLabels, function(d) { return d.id; });

        edgeLabels.exit()
            .transition(transition)
            .style("opacity", 0)
            .remove();

        var enteredEdgeLabels = edgeLabels.enter()
            .append("text")
            .attr("class", "interactive-tree-edge-label")
            .style("opacity", 0)
            .attr("x", function(d) { return d.x; })
            .attr("y", function(d) { return d.y; })
            .text(function(d) { return d.label; });

        edgeLabels = enteredEdgeLabels.merge(edgeLabels);
        edgeLabels.transition(transition)
            .style("opacity", 1)
            .attr("x", function(d) { return d.x; })
            .attr("y", function(d) { return d.y; });

        var nodes = currentStage.layer.selectAll(".interactive-tree-node")
            .data(layout.nodes, function(d) { return d.id; });

        nodes.exit()
            .transition(transition)
            .style("opacity", 0)
            .remove();

        var enteredNodes = nodes.enter()
            .append("g")
            .attr("class", "interactive-tree-node")
            .style("opacity", 0)
            .attr("transform", function(d) {
                var previous = previousPosition(d);
                return "translate(" + previous.x + "," + previous.y + ")";
            });

        enteredNodes.append("circle")
            .attr("r", 20);

        enteredNodes.append("text")
            .attr("class", "interactive-tree-node-label")
            .attr("y", function(d) { return d.isInternal ? 4 : -3; });

        enteredNodes.append("text")
            .attr("class", "interactive-tree-node-frequency")
            .attr("y", 13);

        nodes = enteredNodes.merge(nodes);
        nodes
            .classed("is-internal", function(d) { return d.isInternal; })
            .classed("is-focused", function(d) { return !!focusLookup[d.id]; });

        nodes.select(".interactive-tree-node-label")
            .attr("y", function(d) { return d.isInternal ? 4 : -3; })
            .text(function(d) {
                if (d.isInternal) return d.frequency;
                return d.label === " " ? "space" : d.label;
            });

        nodes.select(".interactive-tree-node-frequency")
            .style("display", function(d) { return d.isInternal ? "none" : null; })
            .text(function(d) { return d.frequency; });

        nodes.transition(transition)
            .style("opacity", 1)
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });

        currentStage.layer.selectAll(".interactive-tree-link").lower();
        currentStage.layer.selectAll(".interactive-tree-edge-label").lower();

        stage.positions = nextPositions;
    }

    window.InteractiveTree = {
        observeResize: function() {
            var host = document.getElementById("tree-viz");
            if (!host || stage.resizeObserver || !window.ResizeObserver) return;

            var resizeFrame = null;
            stage.resizeObserver = new ResizeObserver(function() {
                if (resizeFrame !== null) {
                    window.cancelAnimationFrame(resizeFrame);
                }
                resizeFrame = window.requestAnimationFrame(function() {
                    resizeFrame = null;
                    window.InteractiveTree.rerender();
                });
            });
            stage.resizeObserver.observe(host);
        },
        render: function(step) {
            renderForest(step);
        },
        rerender: function() {
            if (window.InteractiveHuffmanState && window.InteractiveHuffmanState.hasData()) {
                window.InteractiveHuffmanState.rerender();
            } else {
                var host = document.getElementById("tree-viz") || document.getElementById("interactive-tree-svg");
                var rect = host ? host.getBoundingClientRect() : { width: 520, height: 420 };
                var width = Math.max(1, rect.width || (host && host.clientWidth) || 520);
                var height = Math.max(1, rect.height || (host && host.clientHeight) || 420);
                ensureStage().svg
                    .attr("width", width)
                    .attr("height", height)
                    .attr("viewBox", "0 0 " + width + " " + height);
                renderEmpty(width, height);
            }
        }
    };
})();
