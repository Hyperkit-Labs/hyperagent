const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const renderFallbackBlocks = () => {
  const diagrams = document.querySelectorAll("div.mermaid");
  diagrams.forEach((node) => {
    if (node.dataset.mermaidFallbackApplied === "1") {
      return;
    }

    const source = node.textContent ?? "";
    const pre = document.createElement("pre");
    pre.className = "mermaid-fallback";
    pre.dataset.mermaidFallback = "true";

    const code = document.createElement("code");
    code.className = "language-mermaid";
    code.innerHTML = escapeHtml(source.trim());

    pre.appendChild(code);
    node.replaceWith(pre);
  });
};

const mermaid = {
  initialize(_config = {}) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", renderFallbackBlocks, {
        once: true,
      });
      return;
    }
    renderFallbackBlocks();
  },
};

export default mermaid;
