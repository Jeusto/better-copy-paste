import Browser from "webextension-polyfill";

console.log("Background script loaded");

const CONTEXT_MENU_ITEMS = [
  { id: "copy_without_formatting", title: "Copy without formatting" },
  { id: "copy_with_clean_formatting", title: "Copy with clean formatting" },
  { id: "paste_without_formatting", title: "Paste without formatting" },
];

function createContextMenuItems() {
  CONTEXT_MENU_ITEMS.forEach((item) => {
    Browser.contextMenus.create({
      id: item.id,
      title: item.title,
      contexts: ["all"],
    });
  });
}

function handleContextMenuClick(info) {
  if (info.menuItemId === "copy_without_formatting") {
    console.log("Copy without formatting clicked");
    copySelectionWithoutFormatting();
  } else if (info.menuItemId === "copy_with_clean_formatting") {
    console.log("Copy with clean formatting clicked");
    copyWithCleanFormatting();
  } else if (info.menuItemId === "paste_without_formatting") {
    console.log("Paste without formatting clicked");
    pasteWithoutFormatting();
  }
}

function handleCommand(command) {
  if (command === "copy_without_formatting") {
    console.log("Copy without formatting command triggered");
    copySelectionWithoutFormatting();
  } else if (command === "paste_without_formatting") {
    console.log("Paste without formatting command triggered");
    pasteWithoutFormatting();
  }
}

async function getActiveTab() {
  const [activeTab] = await Browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return activeTab;
}

async function executeScriptInActiveTab(func, args: unknown[] = []) {
  const activeTab = await getActiveTab();
  if (activeTab) {
    return await Browser.scripting.executeScript({
      target: { tabId: activeTab.id },
      func,
      args,
    });
  }
  return null;
}

async function copySelectionWithoutFormatting() {
  try {
    const results = await executeScriptInActiveTab(() => {
      const selection = window.getSelection().toString();
      return selection
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    });
    if (results && results[0]) {
      const sanitizedText = results[0].result;
      await writeClipboard(sanitizedText);
    } else {
      console.error("Failed to get selection or sanitize text");
    }
  } catch (error) {
    console.error("Error processing selection:", error);
  }
}

async function copyWithCleanFormatting() {
  try {
    const results = await executeScriptInActiveTab(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }

      const range = selection.getRangeAt(0);
      const container = document.createElement("div");
      container.appendChild(range.cloneContents());

      function cleanNode(node: Node): Node | null {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.cloneNode(true);
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
          return null;
        }

        const el = node as Element;
        const tagName = el.tagName.toLowerCase();

        // Tags to preserve (semantic formatting)
        const preserveTags = [
          "b", "strong", "i", "em", "u", "s", "strike",
          "ul", "ol", "li", "a", "br", "p", "div", "span", "h1", "h2", "h3", "h4", "h5", "h6"
        ];

        // Tags to unwrap (remove tag but keep children)
        const unwrapTags = ["font"];

        let newEl: HTMLElement;

        if (unwrapTags.includes(tagName)) {
          // For font tags, check if they have formatting we should preserve
          const fragment = document.createDocumentFragment();
          let wrapper: HTMLElement | DocumentFragment = fragment;

          // Check for bold via font-weight in style
          const computedStyle = window.getComputedStyle(el as HTMLElement);

          if (computedStyle.fontWeight === "bold" || parseInt(computedStyle.fontWeight) >= 700) {
            const bold = document.createElement("b");
            wrapper.appendChild(bold);
            wrapper = bold;
          }
          if (computedStyle.fontStyle === "italic") {
            const italic = document.createElement("i");
            wrapper.appendChild(italic);
            wrapper = italic;
          }

          for (const child of Array.from(el.childNodes)) {
            const cleaned = cleanNode(child);
            if (cleaned) wrapper.appendChild(cleaned);
          }

          return fragment.childNodes.length > 0 ? fragment : null;
        }

        if (preserveTags.includes(tagName)) {
          if (tagName === "div" || tagName === "span") {
            // Convert divs/spans to simpler structure
            const hasBlockDisplay = window.getComputedStyle(el as HTMLElement).display === "block";
            if (hasBlockDisplay && tagName === "div") {
              newEl = document.createElement("p");
            } else {
              // For spans and inline divs, just keep children
              const fragment = document.createDocumentFragment();
              for (const child of Array.from(el.childNodes)) {
                const cleaned = cleanNode(child);
                if (cleaned) fragment.appendChild(cleaned);
              }
              return fragment.childNodes.length > 0 ? fragment : null;
            }
          } else if (tagName === "a") {
            newEl = document.createElement("a");
            const href = el.getAttribute("href");
            if (href) newEl.setAttribute("href", href);
          } else {
            newEl = document.createElement(tagName);
          }
        } else {
          // Unknown tag - unwrap and keep children
          const fragment = document.createDocumentFragment();
          for (const child of Array.from(el.childNodes)) {
            const cleaned = cleanNode(child);
            if (cleaned) fragment.appendChild(cleaned);
          }
          return fragment.childNodes.length > 0 ? fragment : null;
        }

        // Process children
        for (const child of Array.from(el.childNodes)) {
          const cleaned = cleanNode(child);
          if (cleaned) newEl.appendChild(cleaned);
        }

        // Don't return empty elements (except br)
        if (newEl.childNodes.length === 0 && tagName !== "br") {
          return null;
        }

        return newEl;
      }

      const cleanedContainer = document.createElement("div");
      for (const child of Array.from(container.childNodes)) {
        const cleaned = cleanNode(child);
        if (cleaned) cleanedContainer.appendChild(cleaned);
      }

      // Clean up empty paragraphs and normalize whitespace
      const html = cleanedContainer.innerHTML
        .replace(/<p>\s*<\/p>/gi, "")
        .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, "<br>")
        .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
        .trim();

      const plainText = selection.toString();

      return { html, plainText };
    });

    if (results && results[0] && results[0].result) {
      const { html, plainText } = results[0].result;
      await writeClipboardWithHtml(html, plainText);
    } else {
      console.error("Failed to get selection");
    }
  } catch (error) {
    console.error("Error copying with clean formatting:", error);
  }
}

async function writeClipboard(text) {
  try {
    await executeScriptInActiveTab(
      async (text) => {
        await navigator.clipboard.writeText(text);
      },
      [text]
    );
    console.log("Text written to clipboard!");
  } catch (error) {
    console.error("Error writing to clipboard:", error);
  }
}

async function writeClipboardWithHtml(html: string, plainText: string) {
  try {
    await executeScriptInActiveTab(
      async (html: string, plainText: string) => {
        const htmlBlob = new Blob([html], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });
        const clipboardItem = new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        });
        await navigator.clipboard.write([clipboardItem]);
      },
      [html, plainText]
    );
    console.log("HTML and text written to clipboard!");
  } catch (error) {
    console.error("Error writing HTML to clipboard:", error);
  }
}

async function pasteWithoutFormatting() {
  try {
    await executeScriptInActiveTab(async () => {
      const text = await navigator.clipboard.readText();
      const sanitizedText = text
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const activeElement = document.activeElement;
      if (activeElement && typeof activeElement.value !== "undefined") {
        const start = activeElement.selectionStart;
        const end = activeElement.selectionEnd;
        activeElement.value =
          activeElement.value.substring(0, start) +
          sanitizedText +
          activeElement.value.substring(end);
        activeElement.selectionStart = activeElement.selectionEnd =
          start + sanitizedText.length;
      } else if (document.execCommand) {
        document.execCommand("insertText", false, sanitizedText);
      }
    });
    console.log("Text pasted without formatting!");
  } catch (error) {
    console.error("Error pasting text:", error);
  }
}

Browser.runtime.onInstalled.addListener(() => {
  console.log("Extension installed");
  createContextMenuItems();
});

Browser.contextMenus.onClicked.addListener(handleContextMenuClick);
Browser.commands.onCommand.addListener(handleCommand);
