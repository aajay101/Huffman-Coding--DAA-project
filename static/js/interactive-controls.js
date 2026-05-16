(function() {
    window.IDE_CONTROLLER = window.IDE_CONTROLLER || {};

    function bindButton(buttonId, handler) {
        var button = document.getElementById(buttonId);
        if (!button) return;

        button.addEventListener("click", function() {
            if (!window.InteractiveHuffmanState) return;
            handler();
        });
    }

    function isEditableTarget(target) {
        if (!target) return false;
        var tagName = String(target.tagName || "").toLowerCase();
        return tagName === "input" ||
            tagName === "textarea" ||
            tagName === "select" ||
            target.isContentEditable;
    }

    function bindKeyboardNavigation() {
        var app = document.getElementById("interactive-huffman-app");
        if (!app) return;

        var isActive = false;

        app.addEventListener("pointerdown", function() {
            isActive = true;
        });

        document.addEventListener("pointerdown", function(event) {
            if (!app.contains(event.target)) {
                isActive = false;
            }
        });

        document.addEventListener("keydown", function(event) {
            if (!isActive || isEditableTarget(event.target) || !window.InteractiveHuffmanState) return;

            if (event.key === "ArrowRight") {
                event.preventDefault();
                window.InteractiveHuffmanState.nextStep();
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault();
                window.InteractiveHuffmanState.previousStep();
            }
        });
    }

    window.IDE_CONTROLLER.controls = {
        init: function() {
            bindButton("interactive-prev", function() {
                window.InteractiveHuffmanState.previousStep();
            });

            bindButton("interactive-next", function() {
                window.InteractiveHuffmanState.nextStep();
            });

            bindButton("interactive-reset", function() {
                if (window.InteractiveHuffmanState && typeof window.InteractiveHuffmanState.reset === "function") {
                    window.InteractiveHuffmanState.reset();
                }
            });

            bindKeyboardNavigation();
        },
        sync: function(stepIndex, stepCount) {
            var previousButton = document.getElementById("interactive-prev");
            var nextButton = document.getElementById("interactive-next");
            var resetButton = document.getElementById("interactive-reset");
            var isFinalStep = stepCount > 0 && stepIndex === stepCount - 1;

            if (previousButton) previousButton.disabled = stepIndex <= 0;
            if (nextButton) nextButton.disabled = stepIndex >= stepCount - 1;
            if (resetButton) resetButton.hidden = !isFinalStep;
        }
    };

    window.InteractiveControls = window.IDE_CONTROLLER.controls;
})();
