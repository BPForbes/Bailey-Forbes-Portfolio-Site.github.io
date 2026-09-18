/**
 * Tests for the commit-card renderer.
 *
 * It parses text written by whoever opened a pull request, so the injection and
 * link-scheme paths matter as much as the formatting ones.
 *
 * The module builds DOM nodes, so these run against a small hand-rolled DOM
 * rather than a browser. It implements only what richText.ts actually touches —
 * enough to assert structure without pulling in a dependency the site does not
 * otherwise need.
 */
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

/* -------------------------------------------------------------------------- */
/* Minimal DOM                                                                 */
/* -------------------------------------------------------------------------- */

const VOID_TAGS = new Set(["hr", "br"]);

function escapeText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

class FakeNode {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
  }
}

class FakeText extends FakeNode {
  constructor(data) {
    super();
    this.nodeType = 3;
    this.data = String(data);
  }
  get textContent() {
    return this.data;
  }
  get outerHTML() {
    return escapeText(this.data);
  }
}

class FakeFragment extends FakeNode {
  constructor() {
    super();
    this.nodeType = 11;
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }
  appendChild(node) {
    this.append(node);
    return node;
  }
  get textContent() {
    return this.childNodes.map((child) => child.textContent).join("");
  }
  get outerHTML() {
    return this.childNodes.map((child) => child.outerHTML).join("");
  }
}

class FakeElement extends FakeNode {
  constructor(tagName, namespace) {
    super();
    this.nodeType = 1;
    this.tagName = tagName.toUpperCase();
    this.localName = tagName.toLowerCase();
    this.namespaceURI = namespace ?? "http://www.w3.org/1999/xhtml";
    this.attributes = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  // richText.ts assigns these as properties, so they must round-trip.
  set href(value) {
    this.attributes.set("href", String(value));
  }
  get href() {
    return this.attributes.get("href") ?? "";
  }
  set rel(value) {
    this.attributes.set("rel", String(value));
  }
  set className(value) {
    this.attributes.set("class", String(value));
  }
  get className() {
    return this.attributes.get("class") ?? "";
  }
  set title(value) {
    this.attributes.set("title", String(value));
  }

  set textContent(value) {
    this.childNodes = [];
    this.append(new FakeText(value));
  }
  get textContent() {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  append(...nodes) {
    for (const node of nodes) {
      const child = typeof node === "string" ? new FakeText(node) : node;
      // A fragment is spliced, not nested — matching the real DOM, where
      // appendChild(fragment) moves its children and leaves the fragment empty.
      if (child.nodeType === 11) {
        for (const grandchild of [...child.childNodes]) {
          grandchild.parentNode = this;
          this.childNodes.push(grandchild);
        }
        child.childNodes = [];
        continue;
      }
      child.parentNode = this;
      this.childNodes.push(child);
    }
  }
  appendChild(node) {
    this.append(node);
    return node;
  }

  querySelectorAll(selector) {
    const tag = selector.toLowerCase();
    const found = [];
    const walk = (node) => {
      for (const child of node.childNodes) {
        if (child.nodeType === 1) {
          if (child.localName === tag) {
            found.push(child);
          }
          walk(child);
        }
      }
    };
    walk(this);
    return found;
  }

  get outerHTML() {
    const attrs = [...this.attributes.entries()]
      .map(([name, value]) => ` ${name}="${escapeText(value)}"`)
      .join("");
    if (VOID_TAGS.has(this.localName)) {
      return `<${this.localName}${attrs}>`;
    }
    const inner = this.childNodes.map((child) => child.outerHTML).join("");
    return `<${this.localName}${attrs}>${inner}</${this.localName}>`;
  }
}

let renderMarkdown;
let renderInline;
let markdownToText;

before(async () => {
  globalThis.document = {
    baseURI: "https://bailey-forbes.com/projects/flinstone/",
    createElement: (tag) => new FakeElement(tag),
    createElementNS: (ns, tag) => new FakeElement(tag, ns),
    createTextNode: (text) => new FakeText(text),
    createDocumentFragment: () => new FakeFragment(),
  };
  globalThis.URL = URL;
  ({ renderMarkdown, renderInline, markdownToText } = await import("../js/richText.js"));
});

/** Render to an HTML string for assertions. */
const html = (source) => {
  const holder = new FakeElement("div");
  holder.appendChild(renderMarkdown(source));
  return holder.childNodes.map((child) => child.outerHTML).join("");
};

const inlineHtml = (source) => {
  const holder = new FakeElement("div");
  holder.append(...renderInline(source));
  return holder.childNodes.map((child) => child.outerHTML).join("");
};

/* -------------------------------------------------------------------------- */

describe("inline formatting", () => {
  it("renders the emphasis commit bodies actually use", () => {
    assert.equal(inlineHtml("**bold**"), "<strong>bold</strong>");
    assert.equal(inlineHtml("*italic*"), "<em>italic</em>");
    assert.equal(inlineHtml("~~gone~~"), "<del>gone</del>");
    assert.equal(inlineHtml("`code`"), "<code>code</code>");
  });

  it("leaves snake_case and dunder names alone", () => {
    assert.equal(inlineHtml("browser_kernel_artifact"), "browser_kernel_artifact");
    // CommonMark would make these bold. Commit text is full of identifiers and
    // uses ** for emphasis, so __ is deliberately not an emphasis marker here.
    assert.equal(inlineHtml("__init__ and __main__"), "__init__ and __main__");
    assert.equal(inlineHtml("**still bold**"), "<strong>still bold</strong>");
  });

  it("does not format inside code spans", () => {
    assert.equal(inlineHtml("`**not bold**`"), "<code>**not bold**</code>");
  });

  it("honours backslash escapes", () => {
    assert.equal(inlineHtml("\\*literal\\*"), "*literal*");
  });
});

describe("links", () => {
  it("renders Markdown links and autolinks", () => {
    assert.equal(
      inlineHtml("[the PR](https://github.com/BPForbes/x/pull/1)"),
      '<a href="https://github.com/BPForbes/x/pull/1" rel="noopener">the PR</a>',
    );
    assert.match(inlineHtml("<https://example.com/a>"), /^<a href="https:\/\/example\.com\/a"/);
    assert.match(inlineHtml("see https://example.com/a now"), /<a href="https:\/\/example\.com\/a"/);
  });

  it("refuses javascript: and data: targets but keeps the words", () => {
    const rendered = inlineHtml("[click](javascript:alert(1))");
    assert.equal(rendered, "click");
    assert.ok(!rendered.includes("javascript:"));

    const data = inlineHtml("[x](data:text/html;base64,PHNjcmlwdD4=)");
    assert.equal(data, "x");
  });
});

describe("injection", () => {
  it("escapes HTML rather than parsing it", () => {
    const rendered = html('<script>alert("x")</script>');
    assert.ok(!rendered.includes("<script>"), rendered);
    assert.ok(rendered.includes("&lt;script&gt;"), rendered);
  });

  it("escapes an img onerror payload", () => {
    const rendered = html('<img src=x onerror="alert(1)">');
    assert.ok(!rendered.includes("<img"), rendered);
    assert.ok(rendered.includes("&lt;img"), rendered);
  });

  it("does not let a link title break out of the attribute", () => {
    const rendered = inlineHtml('[a](https://example.com/" onmouseover="alert(1))');
    assert.ok(!rendered.includes('onmouseover="alert(1)"'), rendered);
  });
});

describe("block structure", () => {
  it("renders paragraphs, lists and headings", () => {
    assert.equal(html("one\n\ntwo"), "<p>one</p><p>two</p>");
    assert.equal(html("- a\n- b"), "<ul><li>a</li><li>b</li></ul>");
    assert.equal(html("1. a\n2. b"), "<ol><li>a</li><li>b</li></ol>");
  });

  it("clamps headings to h4-h6 so a card cannot break the page outline", () => {
    assert.equal(html("# Top"), "<h4>Top</h4>");
    assert.equal(html("### Third"), "<h6>Third</h6>");
    assert.equal(html("###### Sixth"), "<h6>Sixth</h6>");
  });

  it("keeps fenced code literal", () => {
    const rendered = html("```\n**not bold**\n```");
    assert.equal(rendered, "<pre><code>**not bold**</code></pre>");
  });

  it("renders block quotes and rules", () => {
    assert.equal(html("> quoted"), "<blockquote><p>quoted</p></blockquote>");
    assert.equal(html("---"), "<hr>");
  });

  it("handles a real generated commit body", () => {
    const rendered = html(
      "The default browser lab now runs the freestanding identity shell as a "
      + "sandboxed Emscripten **Flinstone Shell**. Operators type at `shell>` in "
      + "that terminal.",
    );
    assert.ok(rendered.startsWith("<p>"), rendered);
    assert.ok(rendered.includes("<strong>Flinstone Shell</strong>"), rendered);
    assert.ok(rendered.includes("<code>shell&gt;</code>"), rendered);
  });
});

describe("math", () => {
  it("renders inline and display math as MathML", () => {
    const inline = inlineHtml("$a + b$");
    assert.ok(inline.includes("<math"), inline);
    assert.ok(inline.includes('display="inline"'), inline);

    const display = inlineHtml("$$x^2$$");
    assert.ok(display.includes('display="block"'), display);
    assert.ok(display.includes("<msup>"), display);
  });

  it("renders fractions, roots, scripts and symbols", () => {
    assert.ok(inlineHtml("$\\frac{a}{b}$").includes("<mfrac>"));
    assert.ok(inlineHtml("$\\sqrt{2}$").includes("<msqrt>"));
    assert.ok(inlineHtml("$a_i$").includes("<msub>"));
    assert.ok(inlineHtml("$\\alpha \\le \\beta$").includes("α"));
  });

  it("falls back to the source when it cannot parse, rather than guessing", () => {
    const rendered = inlineHtml("$\\begin{matrix}a\\end{matrix}$");
    assert.ok(rendered.includes("rt-math-raw"), rendered);
    assert.ok(rendered.includes("\\begin{matrix}"), rendered);
    assert.ok(!rendered.includes("<math"), rendered);
  });

  it("leaves currency alone", () => {
    assert.equal(inlineHtml("costs $5 and $10 total"), "costs $5 and $10 total");
  });
});

describe("markdownToText", () => {
  it("flattens to one line for the collapsed row", () => {
    assert.equal(
      markdownToText("# Title\n\nSome **bold** text with `code`."),
      "Title Some bold text with code.",
    );
  });

  it("survives empty input", () => {
    assert.equal(markdownToText(""), "");
  });
});
