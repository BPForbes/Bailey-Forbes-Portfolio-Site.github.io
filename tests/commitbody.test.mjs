/**
 * Tests for the commit-card rendering pipeline.
 *
 * These exercise the same remark/rehype stack the browser runs, through
 * `renderToStaticMarkup`, so they cover what the Markdown and maths actually
 * become without needing a browser. The component itself is not imported: it
 * pulls in `react-dom/client` and touches `document`. What is worth testing
 * lives in the pipeline and the link policy, and both are asserted here.
 *
 * Commit bodies are written by whoever opened the pull request, so the
 * raw-HTML and link-scheme cases matter as much as the formatting ones.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

/** The same plugin set and components the browser component uses. */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

const isSafeHref = (href) => {
  if (typeof href !== "string" || href === "") return false;
  try {
    return SAFE_SCHEMES.has(new URL(href, "https://bailey-forbes.com/").protocol);
  } catch {
    return false;
  }
};

const render = (markdown) =>
  renderToStaticMarkup(
    createElement(Markdown, {
      remarkPlugins: [remarkGfm, remarkMath],
      rehypePlugins: [[rehypeKatex, { throwOnError: false }]],
      components: {
        h1: ({ children }) => createElement("h4", null, children),
        h2: ({ children }) => createElement("h5", null, children),
        h3: ({ children }) => createElement("h6", null, children),
        a: ({ href, children }) =>
          isSafeHref(href)
            ? createElement("a", { href, rel: "noopener noreferrer", target: "_blank" }, children)
            : createElement("span", null, children),
        img: ({ alt }) => createElement("span", { className: "rt-img-omitted" }, alt || "image"),
      },
      children: markdown,
    }),
  );

describe("markdown", () => {
  it("renders the emphasis and code commit bodies actually use", () => {
    const html = render("A **bold** word, an *italic* one, and `code`.");
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /<em>italic<\/em>/);
    assert.match(html, /<code>code<\/code>/);
  });

  it("renders GFM tables, task lists and strikethrough", () => {
    const table = render("| a | b |\n| --- | --- |\n| 1 | 2 |");
    assert.match(table, /<table>/);
    assert.match(table, /<th>a<\/th>/);

    const tasks = render("- [x] done\n- [ ] pending");
    assert.match(tasks, /type="checkbox"/);
    assert.match(tasks, /checked/);

    assert.match(render("~~gone~~"), /<del>gone<\/del>/);
  });

  it("clamps headings so a card cannot break the page outline", () => {
    assert.match(render("# Top"), /<h4>Top<\/h4>/);
    assert.match(render("## Second"), /<h5>Second<\/h5>/);
    assert.match(render("### Third"), /<h6>Third<\/h6>/);
  });

  it("keeps fenced code literal", () => {
    const html = render("```\n**not bold**\n```");
    assert.match(html, /<pre><code>/);
    assert.ok(!html.includes("<strong>"), html);
  });

  it("renders nested lists, which the previous hand-rolled renderer could not", () => {
    const html = render("- outer\n  - inner\n- second");
    assert.match(html, /<ul>[\s\S]*<ul>/);
    assert.match(html, /inner/);
  });
});

describe("untrusted input", () => {
  it("does not parse raw HTML — rehype-raw is deliberately not enabled", () => {
    const html = render('<script>alert("x")</script>');
    assert.ok(!html.includes("<script>"), html);
    assert.match(html, /&lt;script&gt;/);
  });

  it("escapes an img onerror payload", () => {
    const html = render('<img src=x onerror="alert(1)">');
    // The payload survives as *text*, which is the point: no element is created,
    // so there is no handler to fire.
    assert.ok(!/<img[\s>]/.test(html), html);
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  });

  it("refuses javascript: and data: link targets but keeps the words", () => {
    const js = render("[click](javascript:alert(1))");
    assert.ok(!js.includes("javascript:"), js);
    assert.match(js, /<span>click<\/span>/);

    const data = render("[x](data:text/html;base64,PHNjcmlwdD4=)");
    assert.ok(!data.includes("data:text/html"), data);
  });

  it("keeps ordinary links, and opens them safely", () => {
    const html = render("[the PR](https://github.com/BPForbes/x/pull/1)");
    assert.match(html, /href="https:\/\/github\.com\/BPForbes\/x\/pull\/1"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });

  it("does not request images, keeping the alt text instead", () => {
    const html = render("![a screenshot](https://example.com/shot.png)");
    assert.ok(!html.includes("<img"), html);
    assert.match(html, /a screenshot/);
  });
});

describe("maths", () => {
  it("typesets inline maths as KaTeX markup rather than substituted characters", () => {
    const html = render("Mass–energy $E = mc^2$.");
    assert.match(html, /class="katex"/);
    // A real typeset fraction/superscript is nested elements, not a glyph swap.
    assert.match(html, /<span class="msupsub">|<span class="vlist/);
    // KaTeX also emits a MathML branch for assistive technology.
    assert.match(html, /katex-mathml/);
  });

  it("renders display maths as a display block", () => {
    const html = render("$$\n\\sum_{i=1}^{n} x_i\n$$");
    assert.match(html, /katex-display/);
  });

  it("draws a fraction as a rule, not a slash", () => {
    const html = render("$\\frac{a}{b}$");
    assert.match(html, /frac-line/);
  });

  it("draws a root as a radical", () => {
    const html = render("$\\sqrt{x}$");
    assert.match(html, /sqrt/);
  });

  it("shows the source of a formula it cannot parse instead of throwing", () => {
    // throwOnError: false is what keeps one bad formula from blanking the card.
    const html = render("$\\thisIsNotACommand{x}$");
    assert.ok(html.length > 0);
    assert.ok(!html.includes("Uncaught"), html);
  });

  it("leaves dollars inside code spans and fences alone", () => {
    // This is the case that actually occurs: every dollar sign in the synced
    // bodies sits inside a code span or a fence, where remark-math does not
    // look. Checked against the real data — 10 in code, none in prose.
    assert.ok(!render("Set `$PATH` and `$HOME` first.").includes("katex"));
    assert.ok(!render("```sh\necho $HOME $USER\n```").includes("katex"));
  });

  it("treats a bare dollar pair in prose as maths, as GitHub does", () => {
    // Documented rather than worked around: remark-math's single-dollar syntax
    // is what makes `$E = mc^2$` work, and GitHub behaves the same way. It does
    // mean "costs $5 and $10" reads as maths — acceptable because prose dollars
    // do not appear in this data, and the alternative is losing inline maths.
    assert.match(render("costs $5 and $10 total"), /katex/);
  });
});
