function init_scrolling() {
    d3.graphScroll()
        .sections(d3.selectAll('.section'))
        .offset(20)
        .on('active', function(i){
            if (scroll_pos < i) {
                if (i > 53)      scroll_pos = 53;
                else if (i > 26) scroll_pos = Math.max(scroll_pos, 26);
                else if (i > 19) scroll_pos = Math.max(scroll_pos, 19);

                for (var j = scroll_pos; j < i; j++) {
                    if (fxns[j]['ffs']) addToQueue(fxns[j]['ffs'], (fxns[j]['fds'] ? fxns[j]['fds'] : 0));
                    if (fxns[j]['ffa']) fxns[j]['ffa']();
                }
            } else {
                clearTimeout(timeout);
                if (fxns[scroll_pos]['bfs']) addToQueue(fxns[scroll_pos]['bfs'], (fxns[scroll_pos]['bds'] ? fxns[scroll_pos]['bds'] : 0));
                if (fxns[scroll_pos]['bfa']) fxns[scroll_pos]['bfa']();

                if (i == 0) {
                    svg.selectAll("*")
                        .transition().style('opacity', 0)
                        .transition().delay(200).remove();
                }
            }

            scroll_pos = i;
        });
}

function update_freq_table(cs) {
    var t_width = cs.reduce(function(sum, c) {
        return sum + c[0].length;
    }, 0);

    $('#freq-table td').remove();
    $('#freq-table th').remove();

    for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        var h = "<th width='" + (c[0].length * 100 / t_width).toFixed(2) + "%'>" + c[0] + "</th>";
        var d = "<td>" + c[1] + "</td>";

        $('#freq-table tr:nth-of-type(1)').append(h);
        $('#freq-table tr:nth-of-type(2)').append(d);
    }
}

function update_fgk_input(i, o) {
    $('#fgk-input p').html(i + "<span id='unseen'>" + o + "</span>");
}

function clear_all_text() {
    svg.selectAll('text:not(.node-text)')
        .transition()
        .style('opacity', 0)
        .remove();

    svg.selectAll('.annotation-group')
        .transition()
        .style('opacity', 0)
        .remove();
}

function show_text(t, x, y, s, d) {
    svg.append("text")
        .attr("x", x)
        .attr("y", y)
        .text(t)
        .style("font-family", "Roboto Mono")
        .style("font-size", s)
        .style("text-anchor", "middle")
        .style("fill", "#39C0BA")
        .style("opacity", 0)
        .transition()
        .delay(d)
        .style("opacity", 1);
}

function show_fraction(numerator, denominator, x, y, fontSize, delay) {
    var group = svg.append("g")
        .attr("class", "annotation-group")
        .style("opacity", 0);

    group.append("text")
        .attr("x", x)
        .attr("y", y - 18)
        .text(numerator)
        .style("font-family", "Roboto Mono")
        .style("font-size", fontSize)
        .style("text-anchor", "middle")
        .style("fill", "#39C0BA");

    group.append("line")
        .attr("x1", x - 110)
        .attr("x2", x + 110)
        .attr("y1", y)
        .attr("y2", y)
        .style("stroke", "#39C0BA")
        .style("stroke-width", 2);

    group.append("text")
        .attr("x", x)
        .attr("y", y + 28)
        .text(denominator)
        .style("font-family", "Roboto Mono")
        .style("font-size", fontSize)
        .style("text-anchor", "middle")
        .style("fill", "#39C0BA");

    group.transition()
        .delay(delay)
        .style("opacity", 1);
}

function render_time_complexity_stage(stage) {
    clear_all_text();

    if (stage === 1) {
        show_text("T(n) = T(n - 1) + O(log n)", 775, 180, "24px", 0);
        show_fraction("one heap merge / insertion step", "per iteration", 775, 245, "18px", 250);
    } else if (stage === 2) {
        show_text("T(n) = O(n log n)", 775, 185, "30px", 0);
        show_text("S(n) = O(n)", 775, 245, "30px", 250);
    } else if (stage === 3) {
        show_text("Time Complexity", 775, 110, "24px", 0);
        show_text("Best Case: O(n log n)", 775, 170, "24px", 150);
        show_text("Average Case: O(n log n)", 775, 230, "24px", 300);
        show_text("Worst Case: O(n log n)", 775, 290, "24px", 450);
    }
}

function hide_node(i, d) {
    svg.selectAll(i)
        .transition().style('opacity', 0)
        .transition().delay(d).style('display', 'none');

    svg.selectAll('.edge').filter(function() {
        var ni = i.split('-')[1];
        return d3.select(this).attr('id').split('-')[1] === ni || d3.select(this).attr('id').split('-')[2] === ni;
    })
        .transition().style('opacity', 0)
        .transition().delay(100).style('display', 'none');
}

function show_node(i) {
    svg.selectAll(i).style('display', 'initial').transition().style('opacity', 1);

    svg.selectAll('.edge').filter(function() {
        var ni = i.split('-')[1];
        return d3.select(this).attr('id').split('-')[1] === ni;
    }).style('display', 'initial').transition().style('opacity', 1);
}

// takes in gap vals gx + gy, new leaf vals k + v + id, new interior node id
function insert_fgk_node(id, [gx, gy], k, v, ix1, ix2) {
    // get null nodes current pos
    var [px, py] = [parseInt(d3.select('#fgk-0').attr("px")), parseInt(d3.select('#fgk-0').attr("py"))];

    // move null node
    move_node(id, '0', -gx, gy);

    // add new interior node and leaf node
    var [rn, rt] = new_circ_node(px, py, k, v, v, id + '-' + ix1);
    var [nn, nt] = new_rect_node(px + gx, py + gy, k, v, k + ',' + v, id + '-' + ix2);

    rn.style('opacity', 0).transition().style('opacity', 1);
    rt.style('opacity', 0).transition().style('opacity', 1);
    nn.style('opacity', 0).transition().delay(250).style('opacity', 1);
    nt.style('opacity', 0).transition().delay(250).style('opacity', 1);

    // update id on edge into interior node
    svg.selectAll('.edge').filter(function() {
        var i = d3.select(this).attr('id').split('-');
        return i[0] === id && parseInt(i[2]) == 0;
    }).attr('id', function() {
        var i = d3.select(this).attr('id').split('-');
        return i[0] + '-' + i[1] + '-' + ix1;
    });

    // add edge from interior to leaf node
    var p1 = connect_p2c(rn, nn, id + '-' + ix1 + '-' + ix2);
    p1.style('opacity', 0).transition().delay(250).style('opacity', 1);

    // add edge from interior node to where null node will be (after move)
    var x1 = px,
        y1 = py + 15,
        x4 = px - gx,
        y4 = py + gy - 12.5;
    var x2 = x1 + (x4 - x1) / 6,
        y2 = y1 + (y4 - y1) / 6 * 2,
        x3 = x1 + (x4 - x1) / 6 * 5,
        y3 = y1 + (y4 - y1) / 6 * 4;

    var line = d3.line().curve(d3.curveCardinal);
    var p2 = svg.append('path')
        .classed('edge', true)
        .attr('id', id + '-' + ix1 + '-0')
        .attr('d', line([[x1, y1], [x2, y2], [x3, y3], [x4, y4]]))
        .style("stroke", "black")
        .style("fill", "none")
        .style('opacity', 0)
        .transition().delay(250)
        .style('opacity', 1);
}

function uninsert_fgk_node(id, [gx, gy], ix1, ix2) {
    var px = parseInt(d3.select('.node#' + id + '-' + ix1).attr("px")),
        py = parseInt(d3.select('.node#' + id + '-' + ix1).attr("py"));

    var dx = px - parseInt(d3.select('.node#' + id + '-0').attr("px")),
        dy = py - parseInt(d3.select('.node#' + id + '-0').attr("py"));

    svg.selectAll('#' + id + '-' + ix1).transition().style('opacity', 0).transition().delay(250).remove();
    svg.selectAll('#' + id + '-' + ix2).transition().style('opacity', 0).transition().delay(250).remove();
    svg.select('#' + id + '-' + ix1 + '-0').transition().style('opacity', 0).transition().delay(250).remove();
    svg.select('#' + id + '-' + ix1 + '-' + ix2).transition().style('opacity', 0).transition().delay(250).remove();

    svg.selectAll('.edge').filter(function() {
        var i = d3.select(this).attr('id').split('-');
        return i[0] === id && parseInt(i[2]) == ix1;
    }).attr('id', function() {
        var i = d3.select(this).attr('id').split('-');
        return i[0] + '-' + i[1] + '-' + 0;
    });

    move_node('fgk', '0', dx, dy);
}

function update_node_values(id, ns, vs) {
    for (var i = 0; i < ns.length; i++) {
        var n = svg.select('.node#' + id + '-' + ns[i]),
            t = svg.select('.node-text#' + id + '-' + ns[i]);

        if (n.classed('circ')) t.text(vs[i]);
        else t.text(t.text().split(',')[0] + ',' + vs[i]);
    }
}

// takes in id-prefix, list of ids, list of ids to change them to            
function remap_ids(id, o, n) {
    // should probably check that two lists contain same values?

    // remap node and text
    svg.selectAll('.node, .node-text').filter(function() {
        var i = d3.select(this).attr('id').split('-');
        return i[0] === id && o.indexOf(parseInt(i[1])) >= 0;
    }).attr('id', function() {
        var i = d3.select(this).attr('id').split('-');
        return (id + '-' + n[o.indexOf(parseInt(i[1]))]);
    });
    
    // remap edges
    svg.selectAll('.edge').filter(function() {
        var i = d3.select(this).attr('id').split('-');
        return i[0] === id && (o.indexOf(parseInt(i[1])) >= 0 || o.indexOf(parseInt(i[2])) >= 0);
    }).attr('id', function() {
        var i = d3.select(this).attr('id').split('-');
        var n1 = (o.indexOf(parseInt(i[1])) >= 0 ? n[o.indexOf(parseInt(i[1]))] : i[1]);
        var n2 = (o.indexOf(parseInt(i[2])) >= 0 ? n[o.indexOf(parseInt(i[2]))] : i[2]);
        return (id + '-' + n1 + '-' + n2);
    });
}

function clear_fgk_tree() {
    svg.selectAll('.node, .node-text, .edge').filter(function() {
        return d3.select(this).attr('id').indexOf('fgk') >= 0;
    }).remove();
}

function render_fgk_tree(t) {
    clear_fgk_tree();
    build_tree('fgk', t['tree'], '', t['height'], t['root-pos'], t['gap-size']);
}

var fgk_basketball_steps = [
    null,
    {
        "root-pos": [225, 150],
        "gap-size": [30, 75, 1.5],
        "height": 2,
        "tree": {"key":"b","val":1,"id":1,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"b","val":1,"id":2,"left-child":null,"right-child":null}}
    },
    {
        "root-pos": [225, 131.25],
        "gap-size": [30, 75, 1.5],
        "height": 3,
        "tree": {"key":"ab","val":2,"id":1,"left-child":{"key":"a","val":1,"id":3,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"a","val":1,"id":4,"left-child":null,"right-child":null}},"right-child":{"key":"b","val":1,"id":2,"left-child":null,"right-child":null}}
    },
    {
        "root-pos": [225, 112.5],
        "gap-size": [25, 75, 1.5],
        "height": 4,
        "tree": {"key":"sab","val":3,"id":1,"left-child":{"key":"sa","val":2,"id":2,"left-child":{"key":"s","val":1,"id":5,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"s","val":1,"id":6,"left-child":null,"right-child":null}},"right-child":{"key":"a","val":1,"id":4,"left-child":null,"right-child":null}},"right-child":{"key":"b","val":1,"id":3,"left-child":null,"right-child":null}}
    },
    {
        "root-pos": [225, 93.75],
        "gap-size": [25, 75, 1.5],
        "height": 4,
        "tree": {"key":"baks","val":4,"id":1,"left-child":{"key":"ba","val":2,"id":2,"left-child":{"key":"b","val":1,"id":5,"left-child":null,"right-child":null},"right-child":{"key":"a","val":1,"id":4,"left-child":null,"right-child":null}},"right-child":{"key":"ks","val":2,"id":3,"left-child":{"key":"k","val":1,"id":7,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"k","val":1,"id":8,"left-child":null,"right-child":null}},"right-child":{"key":"s","val":1,"id":6,"left-child":null,"right-child":null}}}
    },
    {
        "root-pos": [225, 75],
        "gap-size": [20, 75, 1.5],
        "height": 5,
        "tree": {"key":"bekas","val":5,"id":1,"left-child":{"key":"bek","val":3,"id":3,"left-child":{"key":"b","val":1,"id":5,"left-child":null,"right-child":null},"right-child":{"key":"ek","val":2,"id":4,"left-child":{"key":"e","val":1,"id":9,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"e","val":1,"id":10,"left-child":null,"right-child":null}},"right-child":{"key":"k","val":1,"id":8,"left-child":null,"right-child":null}}},"right-child":{"key":"as","val":2,"id":2,"left-child":{"key":"a","val":1,"id":7,"left-child":null,"right-child":null},"right-child":{"key":"s","val":1,"id":6,"left-child":null,"right-child":null}}}
    },
    {
        "root-pos": [225, 56.25],
        "gap-size": [20, 75, 1.5],
        "height": 5,
        "tree": {"key":"tebkas","val":6,"id":1,"left-child":{"key":"tebk","val":4,"id":3,"left-child":{"key":"te","val":2,"id":5,"left-child":{"key":"t","val":1,"id":11,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"t","val":1,"id":12,"left-child":null,"right-child":null}},"right-child":{"key":"e","val":1,"id":10,"left-child":null,"right-child":null}},"right-child":{"key":"bk","val":2,"id":4,"left-child":{"key":"b","val":1,"id":9,"left-child":null,"right-child":null},"right-child":{"key":"k","val":1,"id":8,"left-child":null,"right-child":null}}},"right-child":{"key":"as","val":2,"id":2,"left-child":{"key":"a","val":1,"id":7,"left-child":null,"right-child":null},"right-child":{"key":"s","val":1,"id":6,"left-child":null,"right-child":null}}}
    },
    {
        "root-pos": [225, 56.25],
        "gap-size": [20, 75, 1.5],
        "height": 5,
        "tree": {"key":"teabsk","val":7,"id":1,"left-child":{"key":"teab","val":5,"id":3,"left-child":{"key":"te","val":2,"id":5,"left-child":{"key":"t","val":1,"id":11,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"t","val":1,"id":12,"left-child":null,"right-child":null}},"right-child":{"key":"e","val":1,"id":10,"left-child":null,"right-child":null}},"right-child":{"key":"ab","val":3,"id":4,"left-child":{"key":"a","val":1,"id":7,"left-child":null,"right-child":null},"right-child":{"key":"b","val":2,"id":6,"left-child":null,"right-child":null}}},"right-child":{"key":"sk","val":2,"id":2,"left-child":{"key":"s","val":1,"id":9,"left-child":null,"right-child":null},"right-child":{"key":"k","val":1,"id":8,"left-child":null,"right-child":null}}}
    },
    {
        "root-pos": [225, 56.25],
        "gap-size": [20, 75, 1.5],
        "height": 5,
        "tree": {"key":"sakbte","val":8,"id":1,"left-child":{"key":"sakb","val":6,"id":3,"left-child":{"key":"sa","val":3,"id":5,"left-child":{"key":"s","val":1,"id":9,"left-child":null,"right-child":null},"right-child":{"key":"a","val":2,"id":8,"left-child":null,"right-child":null}},"right-child":{"key":"kb","val":3,"id":4,"left-child":{"key":"k","val":1,"id":7,"left-child":null,"right-child":null},"right-child":{"key":"b","val":2,"id":6,"left-child":null,"right-child":null}}},"right-child":{"key":"te","val":2,"id":2,"left-child":{"key":"t","val":1,"id":11,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"t","val":1,"id":12,"left-child":null,"right-child":null}},"right-child":{"key":"e","val":1,"id":10,"left-child":null,"right-child":null}}}
    },
    {
        "root-pos": [225, 38.75],
        "gap-size": [15, 75, 1.5],
        "height": 6,
        "tree": {"key":"ltbsake","val":9,"id":1,"left-child":{"key":"ltbsa","val":7,"id":3,"left-child":{"key":"ltb","val":4,"id":5,"left-child":{"key":"lt","val":2,"id":7,"left-child":{"key":"l","val":1,"id":13,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"l","val":1,"id":14,"left-child":null,"right-child":null}},"right-child":{"key":"t","val":1,"id":12,"left-child":null,"right-child":null}},"right-child":{"key":"b","val":2,"id":6,"left-child":null,"right-child":null}},"right-child":{"key":"sa","val":3,"id":4,"left-child":{"key":"s","val":1,"id":9,"left-child":null,"right-child":null},"right-child":{"key":"a","val":2,"id":8,"left-child":null,"right-child":null}}},"right-child":{"key":"ke","val":2,"id":2,"left-child":{"key":"k","val":1,"id":11,"left-child":null,"right-child":null},"right-child":{"key":"e","val":1,"id":10,"left-child":null,"right-child":null}}}
    },
    {
        "root-pos": [225, 38.75],
        "gap-size": [15, 75, 1.5],
        "height": 6,
        "tree": {"key":"stblake","val":10,"id":1,"left-child":{"key":"ke","val":2,"id":2,"left-child":{"key":"k","val":1,"id":11,"left-child":null,"right-child":null},"right-child":{"key":"e","val":1,"id":10,"left-child":null,"right-child":null}},"right-child":{"key":"stbla","val":8,"id":3,"left-child":{"key":"stb","val":4,"id":5,"left-child":{"key":"st","val":2,"id":7,"left-child":{"key":"s","val":1,"id":13,"left-child":{"key":"-","val":0,"id":0,"left-child":null,"right-child":null},"right-child":{"key":"s","val":1,"id":14,"left-child":null,"right-child":null}},"right-child":{"key":"t","val":1,"id":12,"left-child":null,"right-child":null}},"right-child":{"key":"b","val":2,"id":6,"left-child":null,"right-child":null}},"right-child":{"key":"la","val":4,"id":4,"left-child":{"key":"l","val":2,"id":9,"left-child":null,"right-child":null},"right-child":{"key":"a","val":2,"id":8,"left-child":null,"right-child":null}}}}
    }
];

var scroll_pos = 0;
var timeout = null;
var none = function() { return; };
var fxns = [
    {
        // Section 0: Header - no animation
        bfs: none,
        ffs: none,
    },{        
        // Section 1: Intro - show abca animation (moved from section 2)
        bfs: none,
        ffs: function() {
            show_text("abca", 775, 168.75, "28px", 0);
            show_text("00 01 10 00", 775, 281.25, "28px", 500);
        },
    },{
        // Section 2: What is Huffman Coding? - clear abca, show aabaacaa (moved from section 3)
        bfs: function() {
            show_text("abca", 775, 168.75, "28px", 0);
            show_text("00 01 10 00", 775, 281.25, "28px", 500);
        },
        ffs: function() {
            clear_all_text();
            show_text("aabaacaa", 775, 168.75, "28px", 500);
            show_text("00 00 01 00 00 10 00 00", 775, 281.25, "28px", 1000);
        },
    },{
        // Section 3: But what if aabaacaa? - clear aabaacaa (moved from section 4)
        bfs: function() {
            show_text("aabaacaa", 775, 168.75, "28px", 0);
            show_text("00 00 01 00 00 10 00 00", 775, 281.25, "28px", 0);
        },
        ffs: function() {
            clear_all_text();
        },
    },{
        // Section 4: Huffman coding is lossless - show T(n)=T(n-1)+O(log n) (moved from section 5)
        bfs: function() {
            clear_all_text();
        },
        ffs: function() {
            render_time_complexity_stage(1);
        },
    },{
        // Section 5: Time Complexity - show T(n)=O(n log n) and S(n)=O(n) (moved from section 6)
        bfs: function() {
            render_time_complexity_stage(1);
        },
        ffs: function() {
            render_time_complexity_stage(2);
        },
    },{
        // Section 6: During tree construction - show Best/Average/Worst Case (moved from section 7)
        bfs: function() {
            render_time_complexity_stage(2);
        },
        ffs: function() {
            render_time_complexity_stage(3);
        },
    },{
        // Section 7: Space complexity - clear and show tree (moved from section 8)
        bfs: function() {
            render_time_complexity_stage(3);
        },
        ffa: function() {
            d3.select('#freq-table').style('display','block').transition().style('opacity', 1);
        },
        ffs: function() {
            clear_all_text();
            var t = trees['basketball-1'];
            build_tree('basic', t['tree'], '', t['height'], t['root-pos'], t['gap-size']);
            svg.selectAll('.node').style('opacity', 0).style('display', 'none');
            svg.selectAll('.node-text').style('opacity', 0).style('display', 'none');
            svg.selectAll('.edge').style('opacity', 0).style('display', 'none');
        },
    },{
        bfa: function() {
            d3.select('#freq-table')
                .transition().style('opacity', 0)
                .transition().delay(200).style('display','none');
        },
        bfs: function() {
            svg.selectAll('.node').remove();
            svg.selectAll('.node-text').remove();
            svg.selectAll('.edge').remove();
        },
        ffa: function() {
            $('#freq-table th:nth-of-type(' + 3 + '), #freq-table td:nth-of-type(' + 3 + ')').addClass('highlight');
            $('#freq-table th:nth-of-type(' + 4 + '), #freq-table td:nth-of-type(' + 4 + ')').addClass('highlight');
        },
    },{
        bfa: function() {
            $('th.highlight, td.highlight').removeClass('highlight');
        },
        ffa: function() {
            update_freq_table([['b', 2], ['a', 2], ['sk', 2], ['e', 1], ['t', 1], ['l', 2]]);
        },
        ffs: function() {
            show_node('#basic-5');
            show_node('#basic-8');
            show_node('#basic-9');
        },
        fds: 250,
    },{
        bfa: function() {
            update_freq_table([['b', 2], ['a', 2], ['s', 1], ['k', 1], ['e', 1], ['t', 1], ['l', 2]]);
            $('#freq-table th:nth-of-type(' + 3 + '), #freq-table td:nth-of-type(' + 3 + ')').addClass('highlight');
            $('#freq-table th:nth-of-type(' + 4 + '), #freq-table td:nth-of-type(' + 4 + ')').addClass('highlight');
        },
        bfs: function() {
            hide_node('#basic-5', 100);
            hide_node('#basic-8', 100);
            hide_node('#basic-9', 100);
        },
        bds: 250,
        ffa: function() {
            $('#freq-table th:nth-of-type(' + 4 + '), #freq-table td:nth-of-type(' + 4 + ')').addClass('highlight');
            $('#freq-table th:nth-of-type(' + 5 + '), #freq-table td:nth-of-type(' + 5 + ')').addClass('highlight');
        },
    },{
        bfa: function() {
            $('#freq-table th, #freq-table td').removeClass('highlight');
        },
        ffa: function() {
            update_freq_table([['b', 2], ['a', 2], ['sk', 2], ['et', 2], ['l', 2]]);
        },
        ffs: function() {
            show_node('#basic-6');
            show_node('#basic-10');
            show_node('#basic-11');
        },
        fds: 250,
    },{
        bfa: function() {
            update_freq_table([['b', 2], ['a', 2], ['sk', 2], ['e', 1], ['t', 1], ['l', 2]]);
            $('#freq-table th:nth-of-type(' + 4 + '), #freq-table td:nth-of-type(' + 4 + ')').addClass('highlight');
            $('#freq-table th:nth-of-type(' + 5 + '), #freq-table td:nth-of-type(' + 5 + ')').addClass('highlight');
        },
        bfs: function() {
            hide_node('#basic-6', 100);
            hide_node('#basic-10', 100);
            hide_node('#basic-11', 100);
        },
        bds: 350,
        ffa: function() {
            update_freq_table([['sk', 2], ['et', 2], ['l', 2], ['ba', 4]]);
        },
        ffs: function() {
            show_node('#basic-7');
            show_node('#basic-12');
            show_node('#basic-13');
        },
        fds: 250,
    },{
        bfa: function() {
            update_freq_table([['b', 2], ['a', 2], ['sk', 2], ['et', 2], ['l', 2]]);
        },
        bfs: function() {
            hide_node('#basic-7', 100);
            hide_node('#basic-12', 100);
            hide_node('#basic-13', 100);
        },
        bds: 350,
        ffa: function() {
            update_freq_table([['lsk', 4], ['et', 2], ['ba', 4]]);
        },
        ffs: function() {
            show_node('#basic-2');
            show_node('#basic-4');
        },
        fds: 250,
    },{
        bfa: function() {
            update_freq_table([['lsk', 4], ['et', 2], ['ba', 4]]);
        },
        bfs: function() {
            hide_node('#basic-2', 100);
            hide_node('#basic-4', 100);
        },
        bds: 350,
        ffa: function() {
            update_freq_table([['lsk', 4], ['etba', 6]]);
        },
        ffs: function() {
            show_node('#basic-3');
        },
        fds: 250,
    },{
        bfa: function() {
            update_freq_table([['lsk', 4], ['et', 2], ['ba', 4]]);
        },
        bfs: function() {
            hide_node('#basic-3', 100);
        },
        ffa: function() {
            update_freq_table([['lsketba', 10]]);
        },
        ffs: function() {
            show_node('#basic-1');
        },
        fds: 250,
    },{
        bfa: function() {
            update_freq_table([['lsk', 4], ['etba', 6]]);
            hide_node('#basic-1', 100);
        },
        ffs: function() {
            svg.select('.node#basic-1').transition().style('fill', '#5a79e6');
            svg.select('.node#basic-2').transition().delay(200).style('fill', '#5a79e6');
            svg.select('.node#basic-5').transition().delay(400).style('fill', '#5a79e6');
            svg.select('.node#basic-8').transition().delay(600).style('fill', '#5a79e6');

            show_text("s = 010", 775, 427.5, "28px", 1000);
        },
    },{
        bfs: function() {
            svg.selectAll('.node').transition().style('fill', '#2e3037');
            clear_all_text();
        },
        ffs: function() {
            svg.selectAll('.node').transition().style('fill', '#2e3037');
            clear_all_text();

            svg.select('.node#basic-1').transition().delay(200).style('fill', '#5a79e6');
            svg.select('.node#basic-2').transition().delay(400).style('fill', '#5a79e6');
            svg.select('.node#basic-4').transition().delay(600).style('fill', '#5a79e6');

            show_text("l = 00", 775, 427.5, "28px", 1000);
        },
    },{
        bfs: function() {
            svg.selectAll('.node').transition().style('fill', '#2e3037');
            clear_all_text();

            svg.select('.node#basic-1').transition().delay(150).style('fill', '#5a79e6');
            svg.select('.node#basic-2').transition().delay(150).style('fill', '#5a79e6');
            svg.select('.node#basic-5').transition().delay(150).style('fill', '#5a79e6');
            svg.select('.node#basic-8').transition().delay(150).style('fill', '#5a79e6');

            show_text("s = 010", 775, 427.5, "28px", 500);
        },
        ffs: function() {
            svg.selectAll('.node').transition().style('fill', '#2e3037');
            clear_all_text();
        },
    },{
        bfs: function() {
            svg.select('.node#basic-1').transition().style('fill', '#5a79e6');
            svg.select('.node#basic-2').transition().style('fill', '#5a79e6');
            svg.select('.node#basic-4').transition().style('fill', '#5a79e6');

            show_text("l = 00", 775, 427.5, "28px", 250);
        },
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: function() {
            clear_all_text();
            svg.selectAll('.node').remove();
            svg.selectAll('.node-text').remove();
            svg.selectAll('.edge').remove();
        },
    },{
        bfs: function() {
            svg.selectAll('.node').remove();
            svg.selectAll('.node-text').remove();
            svg.selectAll('.edge').remove();

            var t = trees['basketball-1'];
            build_tree('basic', t['tree'], '', t['height'], t['root-pos'], t['gap-size']);
        },
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: function() {
            var [n1, t1] = new_circ_node(225, 150, "a", 9, 9, 'swp_ex1-1');
            var [n2, t2] = new_circ_node(300, 225, "b", 7, 7, 'swp_ex1-2');
            var [n3, t3] = new_circ_node(150, 225, "c", 4, 4, 'swp_ex1-3');
            var [n4, t4] = new_circ_node(225, 300, "d", 2, 2, 'swp_ex1-4');
            var [n5, t5] = new_circ_node( 75, 300, "e", 1, 1, 'swp_ex1-5');

            var p1 = connect_p2c(n1, n2, 'swp_ex1-1-2');
            var p2 = connect_p2c(n1, n3, 'swp_ex1-1-3');
            var p3 = connect_p2c(n3, n4, 'swp_ex1-3-4');
            var p4 = connect_p2c(n3, n5, 'swp_ex1-3-5');

            svg.selectAll('*')
                .classed('sib-tree-1', true)
                .style('opacity', 0).transition().style('opacity', 1);
        },
    },{
        bfs: function() {
            svg.selectAll('*').transition().style('opacity', 0).transition().delay(250).remove();
        },
        ffs: function() {
            svg.selectAll('.sib-tree-1').transition().style('opacity', 0).transition().style('display', 'none');

            var [n1, t1] = new_circ_node(225, 112.5, "a", 12, 12, 'swp_ex2-1');
            var [n2, t2] = new_circ_node(175, 187.5, "b",  4,  7, 'swp_ex2-2');
            var [n3, t3] = new_circ_node(275, 187.5, "c",  8,  8, 'swp_ex2-3');
            var [n4, t4] = new_circ_node(225, 262.5, "d",  3,  6, 'swp_ex2-4');
            var [n5, t5] = new_circ_node(325, 262.5, "e",  6,  4, 'swp_ex2-5');
            var [n6, t6] = new_circ_node(175, 337.5, "f",  1,  1, 'swp_ex2-6');
            var [n7, t7] = new_circ_node(275, 337.5, "g",  2,  2, 'swp_ex2-7');

            var p1 = connect_p2c(n1, n2, 'swp_ex2-1-2');
            var p2 = connect_p2c(n1, n3, 'swp_ex2-1-3');
            var p3 = connect_p2c(n3, n4, 'swp_ex2-3-4');
            var p4 = connect_p2c(n3, n5, 'swp_ex2-3-5');
            var p5 = connect_p2c(n4, n6, 'swp_ex2-4-6');
            var p6 = connect_p2c(n4, n7, 'swp_ex2-4-7');

            svg.selectAll('*:not(.sib-tree-1)')
                .classed('sib-tree-2', true)
                .style('opacity', 0).transition().delay(250).style('opacity', 1);

            n4.style('fill', '#af3131');
            n5.style('fill', '#af3131');
        },
        fds: 500,
    },{
        bfs: function() {
            svg.selectAll('.sib-tree-2').transition().style('opacity', 0).transition().delay(250).remove();

            if (svg.selectAll('#swp_ex1-1').size() == 0) {
                var [n1, t1] = new_circ_node(225, 150, "a", 9, 9, 'swp_ex1-1');
                var [n2, t2] = new_circ_node(300, 225, "b", 7, 7, 'swp_ex1-2');
                var [n3, t3] = new_circ_node(150, 225, "c", 4, 4, 'swp_ex1-3');
                var [n4, t4] = new_circ_node(225, 300, "d", 2, 2, 'swp_ex1-4');
                var [n5, t5] = new_circ_node( 75, 300, "e", 1, 1, 'swp_ex1-5');

                var p1 = connect_p2c(n1, n2, 'swp_ex1-1-2');
                var p2 = connect_p2c(n1, n3, 'swp_ex1-1-3');
                var p3 = connect_p2c(n3, n4, 'swp_ex1-3-4');
                var p4 = connect_p2c(n3, n5, 'swp_ex1-3-5');

                svg.selectAll('*:not(.sib-tree-2)')
                    .classed('sib-tree-1', true)
                    .style('opacity', 0).transition().delay(250).style('opacity', 1);
            } else svg.selectAll('.sib-tree-1').style('display','block').transition().delay(250).style('opacity', 1);
        },
        bds: 500,
        ffs: function() {
            swap_subtrees('swp_ex2', [5],[4,6,7]);
        },
        fds: 250,
    },{
        bfs: function() {
            swap_subtrees('swp_ex2', [4],[5,6,7]);
        },
        bds: 250,
        ffs: function() {
            svg.selectAll('.sib-tree-2').transition().style('opacity', 0).transition().style('display', 'none');

            var [n, t] = new_rect_node(225, 225, "-", 0, "-,0", "fgk-0");

            n.style('opacity', 0).transition().delay(250).style('opacity', 1);
            t.style('opacity', 0).transition().delay(250).style('opacity', 1);
        },
        fds: 500,
    },{
        bfs: function() {
            svg.selectAll('#fgk-0').transition().style('opacity', 0).transition().delay(250).remove();

            if (svg.selectAll('#swp_ex2-1').size() == 0) {
                var [n1, t1] = new_circ_node(225, 112.5, "a", 12, 12, 'swp_ex2-1');
                var [n2, t2] = new_circ_node(175, 187.5, "b",  4,  7, 'swp_ex2-2');
                var [n3, t3] = new_circ_node(275, 187.5, "c",  8,  8, 'swp_ex2-3');
                var [n4, t4] = new_circ_node(325, 262.5, "d",  3,  6, 'swp_ex2-5');
                var [n5, t5] = new_circ_node(225, 262.5, "e",  6,  4, 'swp_ex2-4');
                var [n6, t6] = new_circ_node(275, 337.5, "f",  1,  1, 'swp_ex2-6');
                var [n7, t7] = new_circ_node(375, 337.5, "g",  2,  2, 'swp_ex2-7');

                var p1 = connect_p2c(n1, n2, 'swp_ex2-1-2');
                var p2 = connect_p2c(n1, n3, 'swp_ex2-1-3');
                var p3 = connect_p2c(n3, n4, 'swp_ex2-3-4');
                var p4 = connect_p2c(n3, n5, 'swp_ex2-3-5');
                var p5 = connect_p2c(n4, n6, 'swp_ex2-4-6');
                var p6 = connect_p2c(n4, n7, 'swp_ex2-4-7');

                svg.selectAll('*:not(#fgk-0)')
                    .classed('sib-tree-2', true)
                    .style('opacity', 0).transition().delay(250).style('opacity', 1);

                n4.style('fill', '#af3131');
                n5.style('fill', '#af3131');
            } else svg.selectAll('.sib-tree-2').style('display','block').transition().delay(250).style('opacity', 1);
        },
        ffa: function() {
            d3.select('#fgk-input').style('display','block').transition().style('opacity', 1);
        },
    },{
        bfa: function() {
            d3.select('#fgk-input')
                .transition().style('opacity', 0)
                .transition().delay(200).style('display','none');
        },
        ffa: function() {
            update_fgk_input("b","asketball");
        },
    },{
        bfa: function() {
            update_fgk_input("","basketball");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[1]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("ba","sketball");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[2]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("bas","ketball");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[3]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("bask","etball");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[4]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("baske","tball");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[5]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("basket","ball");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[6]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("basketb","all");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[7]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("basketba","ll");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[8]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        ffa: function() {
            update_fgk_input("basketbal","l");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[9]);
        },
        fds: 250
    },{
        bfs: none,
        ffa: function() {
            update_fgk_input("basketball","");
        },
        ffs: function() {
            render_fgk_tree(fgk_basketball_steps[10]);
        },
        fds: 250
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        bds: 250,
        ffs: function() {
            svg.selectAll('.node, .node-text, .edge').filter(function() {
                return d3.select(this).attr('id').indexOf('fgk') >= 0;
            }).remove();

            var t1 = trees['basketball-1'];
            var t2 = trees['basketball-2'];

            if (svg.select('#basic-1').size() == 0) build_tree('basic', t1['tree'], '', t1['height'], t1['root-pos'], t1['gap-size']);
            if (svg.select('#fgk-1').size() == 0)   build_tree('fgk', t2['tree'], '', t2['height'], t2['root-pos'], t2['gap-size']);

            d3.select('#fgk-input')
                .transition().style('opacity', 0)
                .transition().delay(200).style('display','none');
        },
        fds: 500
    },{
        bfs: none,
        bds: 250,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: function() {
            svg.selectAll('.node, .node-text, .edge').filter(function() {
                return true;
            }).remove();

            var t = trees['basketball-2'];
            build_tree('fgk', t['tree'], '', t['height'], t['root-pos'], t['gap-size']);

            svg.selectAll('.node, .node-text, .edge').filter(function() {
                return d3.select(this).attr('id').indexOf('fgk') >= 0;
            }).style('opacity', 0).transition().style('opacity', 1);

            $('.word-select select').val('basketball');
        },
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    },{
        bfs: none,
        ffs: none,
    }
]
