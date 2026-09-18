import { jsx } from "react/jsx-runtime";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
const SAFE_SCHEMES = /* @__PURE__ */ new Set(["http:", "https:", "mailto:"]);
const KATEX_STYLESHEET = "/css/vendor/katex/katex.min.css";
function ensureKatexStylesheet() {
  if (document.querySelector(`link[href="${KATEX_STYLESHEET}"]`) !== null) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = KATEX_STYLESHEET;
  document.head.appendChild(link);
}
function isSafeHref(href) {
  if (href === void 0 || href === "") {
    return false;
  }
  try {
    return SAFE_SCHEMES.has(new URL(href, document.baseURI).protocol);
  } catch {
    return false;
  }
}
function CommitBody({ markdown }) {
  return /* @__PURE__ */ jsx(
    Markdown,
    {
      remarkPlugins: [remarkGfm, remarkMath],
      rehypePlugins: [[rehypeKatex, {
        // Show the source of a formula KaTeX cannot parse instead of throwing
        // it away or rendering something subtly wrong.
        throwOnError: false,
        errorColor: "var(--status-warn, #c98a4a)"
      }]],
      components: {
        // Headings are clamped: a card sits inside a page that already owns
        // h1–h3, and a commit body starting at h1 would break the outline.
        h1: ({ children }) => /* @__PURE__ */ jsx("h4", { children }),
        h2: ({ children }) => /* @__PURE__ */ jsx("h5", { children }),
        h3: ({ children }) => /* @__PURE__ */ jsx("h6", { children }),
        h4: ({ children }) => /* @__PURE__ */ jsx("h6", { children }),
        h5: ({ children }) => /* @__PURE__ */ jsx("h6", { children }),
        h6: ({ children }) => /* @__PURE__ */ jsx("h6", { children }),
        a: ({ href, children }) => isSafeHref(href) ? /* @__PURE__ */ jsx("a", { href, rel: "noopener noreferrer", target: "_blank", children }) : /* @__PURE__ */ jsx("span", { children }),
        // Tables can be wider than the card; give them their own scroller
        // rather than letting one push the page sideways on a phone.
        table: ({ children }) => /* @__PURE__ */ jsx("div", { className: "rt-table-scroll", children: /* @__PURE__ */ jsx("table", { children }) }),
        img: ({ alt }) => /* @__PURE__ */ jsx("span", { className: "rt-img-omitted", children: alt || "image" })
      },
      children: markdown
    }
  );
}
const roots = /* @__PURE__ */ new WeakMap();
function renderCommitBody(container, markdown) {
  ensureKatexStylesheet();
  let root = roots.get(container);
  if (root === void 0) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(
    /* @__PURE__ */ jsx(StrictMode, { children: /* @__PURE__ */ jsx(CommitBody, { markdown }) })
  );
}
function unmountCommitBody(container) {
  const root = roots.get(container);
  if (root !== void 0) {
    roots.delete(container);
    queueMicrotask(() => {
      root.unmount();
    });
  }
}
export {
  renderCommitBody,
  unmountCommitBody
};
