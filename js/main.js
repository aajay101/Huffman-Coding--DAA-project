$(document).ready(function() {
    if ($(window).width() < 1010 || $(window).height() < 550) screen_warning.open();

    init_scrolling();
    update_page_height();
    update_sticky_visual_state();
});

$(window).resize(function() {      
    if ($(window).width() < 1010 || $(window).height() < 550) {
        if ($('#screen-warning').css('display') != "block") screen_warning.open();
    } else {
        screen_warning.close();
    }

    update_page_height();
    update_sticky_visual_state();
});

$(window).scroll(function() {
    var progress = ($(window).scrollTop() / ($('body').height() - $(window).height())).toFixed(4);
    $('.progress-bar').css('height', 'calc(100vh * ' + progress + ')');
    update_sticky_visual_state();
});

var screen_warning = new jBox('Notice', {
  content: 'This page is best viewed in a larger window. Try resizing your window!',
  id: 'screen-warning'
});

var width  = $('.svg-container').width(),
    height = $('.svg-container').height();

var svg = d3.select(".svg-container").append("svg")
    .attr("width",  width)
    .attr("height", height);

var tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

function update_page_height() {
    var mask = $('#basic');
    if (!mask.length) return;

    var totalHeight = mask.offset().top + mask.outerHeight() + 120;
    $('body').css('height', Math.max(totalHeight, $(window).height()) + 'px');
}

function update_sticky_visual_state() {
    var finalStaticSection = $('#basic > .section').last();
    var codeBlock = $('.code-explanation-block');
    if (!finalStaticSection.length && !codeBlock.length) return;

    var triggerCandidates = [];

    if (finalStaticSection.length) {
        triggerCandidates.push(finalStaticSection.offset().top - ($(window).height() * 0.45));
    }

    if (codeBlock.length) {
        triggerCandidates.push(codeBlock.offset().top - ($(window).height() * 0.35));
    }

    var triggerTop = Math.min.apply(null, triggerCandidates);
    var shouldHide = $(window).scrollTop() >= triggerTop;

    $('body').toggleClass('hide-scroll-visual', shouldHide);
}
