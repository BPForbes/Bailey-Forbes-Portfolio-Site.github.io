/**
 * Commit bodies, rendered with react-markdown and KaTeX.
 *
 * This is the whole reason the site has a bundler. It is reached only through a
 * dynamic `import()` from the timeline, so React, react-markdown and KaTeX are
 * fetched the first time someone expands a commit card and never for a visitor
 * who does not. That is the trade being made: the page stays as light as it was,
 * and the weight lands on the interaction that asked for it.
 *
 * Why these libraries rather than the hand-rolled subset that was here before:
 * the previous renderer approximated maths by substituting Unicode characters,
 * so `\frac{a}{b}` became text that merely looked arranged. KaTeX typesets it —
 * real rules, real radicals, correct spacing and baselines — which is what
 * makes a formula readable rather than suggested. GitHub renders these bodies
 * with a full CommonMark + GFM pipeline, and react-markdown (remark/rehype) is
 * the same lineage, so a table, a task list or a nested list renders the way its
 * author saw it on the pull request.
 *
 * Safety: react-markdown does not parse raw HTML unless `rehype-raw` is added,
 * and it is deliberately not. Commit bodies are written by whoever opened the
 * pull request, so any embedded HTML is shown as text. Link targets are checked
 * against a scheme allowlist on top of that.
 */
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** Schemes a rendered link may use. Anything else renders as plain text. */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

const KATEX_STYLESHEET = "/css/vendor/katex/katex.min.css";

/**
 * Add KaTeX's stylesheet the first time a card renders.
 *
 * Injected here rather than linked from every page so it is not requested until
 * something needs it. It is vendored locally, so this is still a same-origin
 * request (DESIGN.md R29).
 */
function ensureKatexStylesheet(): void {
  if (document.querySelector(`link[href="${KATEX_STYLESHEET}"]`) !== null) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = KATEX_STYLESHEET;
  document.head.appendChild(link);
}

function isSafeHref(href: string | undefined): boolean {
  if (href === undefined || href === "") {
    return false;
  }
  try {
    return SAFE_SCHEMES.has(new URL(href, document.baseURI).protocol);
  } catch {
    return false;
  }
}

function CommitBody({ markdown }: { markdown: string }): React.JSX.Element {
  return (
    <Markdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, {
        // Show the source of a formula KaTeX cannot parse instead of throwing
        // it away or rendering something subtly wrong.
        throwOnError: false,
        errorColor: "var(--status-warn, #c98a4a)",
      }]]}
      components={{
        // Headings are clamped: a card sits inside a page that already owns
        // h1–h3, and a commit body starting at h1 would break the outline.
        h1: ({ children }) => <h4>{children}</h4>,
        h2: ({ children }) => <h5>{children}</h5>,
        h3: ({ children }) => <h6>{children}</h6>,
        h4: ({ children }) => <h6>{children}</h6>,
        h5: ({ children }) => <h6>{children}</h6>,
        h6: ({ children }) => <h6>{children}</h6>,
        a: ({ href, children }) => (
          isSafeHref(href)
            ? <a href={href} rel="noopener noreferrer" target="_blank">{children}</a>
            // Keep the words, drop the target: a javascript: or data: URL in a
            // commit body is not something to hand a reader.
            : <span>{children}</span>
        ),
        // Tables can be wider than the card; give them their own scroller
        // rather than letting one push the page sideways on a phone.
        table: ({ children }) => (
          <div className="rt-table-scroll"><table>{children}</table></div>
        ),
        img: ({ alt }) => <span className="rt-img-omitted">{alt || "image"}</span>,
      }}
    >
      {markdown}
    </Markdown>
  );
}

const roots = new WeakMap<HTMLElement, Root>();

/**
 * Render (or re-render) a commit body into `container`.
 *
 * Roots are kept per container so paging the timeline updates in place instead
 * of tearing down and rebuilding React on every selection.
 */
export function renderCommitBody(container: HTMLElement, markdown: string): void {
  ensureKatexStylesheet();
  let root = roots.get(container);
  if (root === undefined) {
    root = createRoot(container);
    roots.set(container, root);
  }
  root.render(
    <StrictMode>
      <CommitBody markdown={markdown} />
    </StrictMode>,
  );
}

/** Drop a container's root, for when its row leaves the window. */
export function unmountCommitBody(container: HTMLElement): void {
  const root = roots.get(container);
  if (root !== undefined) {
    roots.delete(container);
    // Deferred: React refuses to unmount synchronously from inside a render or
    // a lifecycle, and callers reach this from event handlers either way.
    queueMicrotask(() => {
      root.unmount();
    });
  }
}
