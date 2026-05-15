(function() {
    var store = {
        response: null,
        steps: [],
        currentStep: -1,
        renderFrameId: null,
        treeFrameId: null
    };

    function getWrapper() {
        return document.getElementById("interactive-huffman-app");
    }

    function scheduleTreeRerender() {
        window.requestAnimationFrame(function() {
            window.requestAnimationFrame(function() {
                if (window.InteractiveTree && typeof window.InteractiveTree.rerender === "function") {
                    window.InteractiveTree.rerender();
                }
            });
        });
    }

    window.IDE_STATE = {
        mode: "setup",
        enterDebugMode: function() {
            var wrapper = getWrapper();
            this.mode = "debug";
            if (wrapper) {
                wrapper.classList.remove("is-setup");
                wrapper.classList.add("is-debug");
            }
            scheduleTreeRerender();
        },
        exitDebugMode: function() {
            var wrapper = getWrapper();
            this.mode = "setup";
            if (wrapper) {
                wrapper.classList.remove("is-debug");
                wrapper.classList.add("is-setup");
            }
            scheduleTreeRerender();
        },
        isDebugMode: function() {
            return this.mode === "debug";
        }
    };

    function scheduleRender(index) {
        if (!store.steps.length) return;

        var boundedIndex = Math.max(0, Math.min(index, store.steps.length - 1));
        store.currentStep = boundedIndex;

        if (store.renderFrameId !== null) {
            window.cancelAnimationFrame(store.renderFrameId);
        }

        store.renderFrameId = window.requestAnimationFrame(function() {
            store.renderFrameId = null;
            var step = store.steps[store.currentStep];
            if (!step) return;

            if (window.InteractiveUI && typeof window.InteractiveUI.renderStep === "function") {
                window.InteractiveUI.renderStep(step, store.response, store.currentStep, store.steps.length);
            }

            if (window.InteractiveTree && typeof window.InteractiveTree.render === "function") {
                window.InteractiveTree.render(step);
            }
        });
    }

    function scheduleTreeOnlyRender() {
        if (!store.steps.length || store.currentStep < 0) return;

        if (store.treeFrameId !== null) {
            window.cancelAnimationFrame(store.treeFrameId);
        }

        store.treeFrameId = window.requestAnimationFrame(function() {
            store.treeFrameId = null;

            var step = store.steps[store.currentStep];
            if (!step) return;

            if (window.InteractiveTree && typeof window.InteractiveTree.render === "function") {
                window.InteractiveTree.render(step);
            }
        });
    }

    window.InteractiveHuffmanState = {
        setResponse: function(response) {
            store.response = response;
            store.steps = response.steps || [];
            store.currentStep = store.steps.length ? 0 : -1;
            scheduleRender(store.currentStep);
        },
        renderStep: function(index) {
            scheduleRender(index);
        },
        nextStep: function() {
            if (store.currentStep < store.steps.length - 1) {
                scheduleRender(store.currentStep + 1);
            }
        },
        previousStep: function() {
            if (store.currentStep > 0) {
                scheduleRender(store.currentStep - 1);
            }
        },
        getCurrentStepIndex: function() {
            return store.currentStep;
        },
        getStepCount: function() {
            return store.steps.length;
        },
        hasData: function() {
            return store.steps.length > 0;
        },
        rerender: function() {
            scheduleTreeOnlyRender();
        },
        reset: function() {
            if (store.renderFrameId !== null) {
                window.cancelAnimationFrame(store.renderFrameId);
                store.renderFrameId = null;
            }

            if (store.treeFrameId !== null) {
                window.cancelAnimationFrame(store.treeFrameId);
                store.treeFrameId = null;
            }

            store.response = null;
            store.steps = [];
            store.currentStep = -1;

            if (window.InteractiveUI && typeof window.InteractiveUI.reset === "function") {
                window.InteractiveUI.reset();
            }

            if (window.IDE_STATE && typeof window.IDE_STATE.exitDebugMode === "function") {
                window.IDE_STATE.exitDebugMode();
            }
        }
    };
})();
