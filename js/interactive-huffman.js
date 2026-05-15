(function() {
    window.IDE_CONTROLLER = window.IDE_CONTROLLER || {};

    function bootstrap() {
        if (!document.getElementById("interactive-huffman-app")) return;

        if (window.InteractiveUI && typeof window.InteractiveUI.init === "function") {
            window.InteractiveUI.init();
        }

        if (window.InteractiveControls) {
            window.InteractiveControls.init();
        }

        if (window.InteractiveTree) {
            if (typeof window.InteractiveTree.observeResize === "function") {
                window.InteractiveTree.observeResize();
            }
            window.InteractiveTree.rerender();
        }

        var form = document.getElementById("interactive-huffman-form");
        var input = document.getElementById("interactive-input");

        if (form) {
            form.addEventListener("submit", function(event) {
                event.preventDefault();
                submitText(input ? input.value : "");
            });
        }

        var resizeFrame = null;
        window.addEventListener("resize", function() {
            if (resizeFrame !== null) {
                window.cancelAnimationFrame(resizeFrame);
            }
            resizeFrame = window.requestAnimationFrame(function() {
                resizeFrame = null;
                if (window.InteractiveTree) {
                    window.InteractiveTree.rerender();
                }
            });
        });
    }

    function submitText(text) {
        if (!window.InteractiveUI) return;

        if (typeof text !== "string" || text.length === 0) {
            window.InteractiveUI.showError("Enter some text to generate a Huffman trace.");
            return;
        }

        window.InteractiveUI.clearError();
        window.InteractiveUI.setBusy(true);

        fetch("/encode", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ text: text })
        })
            .then(function(response) {
                if (!response.ok) {
                    return response.json().then(function(payload) {
                        throw new Error(payload.error || "Encoding failed.");
                    });
                }
                return response.json();
            })
            .then(function(payload) {
                window.InteractiveUI.clearError();
                if (window.IDE_STATE && typeof window.IDE_STATE.enterDebugMode === "function") {
                    window.IDE_STATE.enterDebugMode();
                }
                if (window.InteractiveHuffmanState) {
                    window.InteractiveHuffmanState.setResponse(payload);
                }
            })
            .catch(function(error) {
                window.InteractiveUI.showError(error.message || "Unable to reach the Huffman backend.");
            })
            .finally(function() {
                window.InteractiveUI.setBusy(false);
            });
    }

    window.IDE_CONTROLLER.submitText = submitText;
    window.IDE_CONTROLLER.bootstrap = bootstrap;

    document.addEventListener("DOMContentLoaded", bootstrap);
})();
