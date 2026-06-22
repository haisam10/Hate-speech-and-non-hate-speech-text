(async function () {
    try {
        const response = await fetch(
            chrome.runtime.getURL("data.json")
        );

        const data = await response.json();

        const hateTexts = data
            .filter(item => item && item.label === 1 && item.text)
            .map(item => item.text.trim())
            .filter(Boolean);

        if (!hateTexts.length) {
            console.warn("Hate Detector: no phrases to replace.");
            return;
        }

        const regexes = hateTexts.map(hate => new RegExp(
            hate.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"),
            "gi"
        ));

        const blockedTags = new Set([
            "SCRIPT",
            "STYLE",
            "NOSCRIPT",
            "TEXTAREA",
            "INPUT",
            "CODE",
            "PRE"
        ]);

        function replacePhrase(text) {
            if (!text) return text;
            let result = text;
            regexes.forEach(regex => {
                result = result.replace(regex, "**{HATE-Speech}**");
            });
            return result;
        }

        function processTextNode(node) {
            if (
                !node ||
                node.nodeType !== Node.TEXT_NODE ||
                !node.parentNode ||
                blockedTags.has(node.parentNode.tagName)
            ) {
                return;
            }

            const replaced = replacePhrase(node.nodeValue);
            if (replaced !== node.nodeValue) {
                node.nodeValue = replaced;
            }
        }

        function scanElement(root) {
            if (!root) return;

            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node = walker.nextNode();
            while (node) {
                processTextNode(node);
                node = walker.nextNode();
            }
        }

        function scanRoot(root) {
            if (!root) return;
            if (root.nodeType === Node.TEXT_NODE) {
                processTextNode(root);
            } else if (root.nodeType === Node.ELEMENT_NODE) {
                scanElement(root);
            }

            if (root.shadowRoot) {
                scanRoot(root.shadowRoot);
            }
        }

        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(scanRoot);
                if (mutation.type === "characterData") {
                    processTextNode(mutation.target);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        console.log("Hate Detector loaded, phrases:", hateTexts.length);
        scanRoot(document.body);
    } catch (error) {
        console.error("Hate Detector failed:", error);
    }
})();