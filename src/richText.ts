/**
 * A small Markdown + LaTeX-math renderer for commit cards.
 *
 * Timeline detail already arrives as Markdown — the sync copies pull request
 * bodies, which carry `**bold**`, backticked identifiers and `-` lists — and
 * rendering it as plain text put that punctuation on the page verbatim. This
 * turns it into real markup.
 *
 * Two deliberate constraints:
 *
 *   1. **No dependency.** A Markdown parser and a TeX engine would be far more
 *      bytes than this whole site, and DESIGN.md R29 keeps third-party runtime
 *      requests off the page. So this is a documented subset, not a spec
 *      implementation.
 *   2. **No HTML strings.** Everything below builds DOM nodes and assigns text
 *      through `textContent`. Commit text is other people's writing arriving
 *      through an API, and a renderer that concatenated it into `innerHTML`
 *      would be an injection hole. There is no code path here that parses HTML.
 *
 * Supported Markdown: paragraphs, ATX headings, unordered and ordered lists,
 * fenced and indented code blocks, block quotes, `**bold**`, `*italic*`,
 * `` `code` ``, `~~strikethrough~~`, autolinks and `[text](url)`.
 *
 * Deliberately *not* supported: `__bold__`. CommonMark accepts it, but commit
 * text is full of `__init__`-shaped identifiers and uses `**` for emphasis, so
 * underscores only ever italicise at a word boundary.
 *
 * Supported math: `$inline$` and `$$display$$`, covering the constructs listed
 * in `MATH_COMMANDS` plus sub/superscripts, fractions, roots and groupings.
 * Anything it cannot parse falls back to the literal source in a `<code>`
 * element rather than rendering something subtly wrong.
 */

/** Schemes a link may use. Anything else renders as plain text. */
const SAFE_SCHEMES = ["http:", "https:", "mailto:"];

/* -------------------------------------------------------------------------- */
/* Links                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Resolve a URL, or undefined when it is not one we are willing to link.
 *
 * `javascript:` and `data:` are the reason this exists: commit text is written
 * by whoever opened the pull request.
 */
function safeUrl(raw: string): string | undefined {
  try {
    const url = new URL(raw, document.baseURI);
    return SAFE_SCHEMES.includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function anchor(href: string, text: string): HTMLAnchorElement {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  link.rel = "noopener";
  return link;
}

/* -------------------------------------------------------------------------- */
/* Math                                                                        */
/* -------------------------------------------------------------------------- */

/** Symbols rendered as-is, keyed by LaTeX command name (without backslash). */
const MATH_COMMANDS: Readonly<Record<string, string>> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", zeta: "ζ",
  eta: "η", theta: "θ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ",
  nu: "ν", xi: "ξ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ",
  upsilon: "υ", phi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π",
  Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  times: "×", cdot: "⋅", div: "÷", pm: "±", mp: "∓",
  leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠",
  approx: "≈", equiv: "≡", sim: "∼", propto: "∝",
  infty: "∞", partial: "∂", nabla: "∇", forall: "∀", exists: "∃",
  in: "∈", notin: "∉", subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩",
  sum: "∑", prod: "∏", int: "∫", oint: "∮",
  rightarrow: "→", to: "→", leftarrow: "←", leftrightarrow: "↔",
  Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔",
  land: "∧", lor: "∨", neg: "¬", oplus: "⊕", otimes: "⊗",
  ldots: "…", cdots: "⋯", dots: "…", quad: " ", qquad: "  ",
};

const MATHML_NS = "http://www.w3.org/1998/Math/MathML";

function mathEl(name: string, text?: string): Element {
  const el = document.createElementNS(MATHML_NS, name);
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

/** Thrown when the subset cannot represent an expression; triggers fallback. */
class MathUnsupported extends Error {}

/**
 * A recursive-descent reader over a LaTeX fragment.
 *
 * Small and strict on purpose: it either produces MathML it is confident in, or
 * throws so the caller can show the source instead. Guessing would put wrong
 * mathematics on the page, which is worse than showing the TeX.
 */
class MathReader {
  private index = 0;

  constructor(private readonly source: string) {}

  private peek(): string | undefined {
    return this.source[this.index];
  }

  private eatSpace(): void {
    while (this.index < this.source.length && /\s/.test(this.source[this.index] ?? "")) {
      this.index += 1;
    }
  }

  /** One atom: a group, command, number, identifier or operator. */
  private atom(): Element {
    this.eatSpace();
    const char = this.peek();
    if (char === undefined) {
      throw new MathUnsupported("unexpected end of expression");
    }

    if (char === "{") {
      this.index += 1;
      const row = this.row("}");
      this.index += 1;
      return row;
    }

    if (char === "\\") {
      return this.command();
    }

    if (/[0-9]/.test(char)) {
      let digits = "";
      while (/[0-9.]/.test(this.source[this.index] ?? "")) {
        digits += this.source[this.index];
        this.index += 1;
      }
      return mathEl("mn", digits);
    }

    if (/[A-Za-z]/.test(char)) {
      this.index += 1;
      return mathEl("mi", char);
    }

    if ("+-*/=<>(),.[]|!:;".includes(char)) {
      this.index += 1;
      return mathEl("mo", char === "-" ? "−" : char);
    }

    throw new MathUnsupported(`unsupported character '${char}'`);
  }

  private command(): Element {
    this.index += 1; // the backslash
    let name = "";
    while (/[A-Za-z]/.test(this.source[this.index] ?? "")) {
      name += this.source[this.index];
      this.index += 1;
    }

    if (name === "frac") {
      const numerator = this.atom();
      const denominator = this.atom();
      const frac = mathEl("mfrac");
      frac.append(numerator, denominator);
      return frac;
    }

    if (name === "sqrt") {
      const radicand = this.atom();
      const root = mathEl("msqrt");
      root.append(radicand);
      return root;
    }

    if (name === "text" || name === "mathrm") {
      this.eatSpace();
      if (this.peek() !== "{") {
        throw new MathUnsupported(`\\${name} needs a braced argument`);
      }
      this.index += 1;
      let text = "";
      while (this.index < this.source.length && this.source[this.index] !== "}") {
        text += this.source[this.index];
        this.index += 1;
      }
      if (this.source[this.index] !== "}") {
        throw new MathUnsupported(`\\${name} is not closed`);
      }
      this.index += 1;
      return mathEl("mtext", text);
    }

    // \left( … \right) — the delimiters are kept, the sizing is left to the
    // renderer, which is close enough at this scale.
    if (name === "left" || name === "right") {
      const delimiter = this.source[this.index];
      if (delimiter === undefined) {
        throw new MathUnsupported(`\\${name} needs a delimiter`);
      }
      this.index += 1;
      return mathEl("mo", delimiter === "." ? "" : delimiter);
    }

    const symbol = MATH_COMMANDS[name];
    if (symbol === undefined) {
      throw new MathUnsupported(`unsupported command \\${name}`);
    }
    // Large operators and relations are <mo>; letters read as identifiers.
    return mathEl(/^[a-z]/.test(name) && /[α-ωΑ-Ω]/.test(symbol) ? "mi" : "mo", symbol);
  }

  /** A sequence of atoms with their scripts, up to `stop` or end of input. */
  private row(stop?: string): Element {
    const row = mathEl("mrow");
    for (;;) {
      this.eatSpace();
      const char = this.peek();
      if (char === undefined || (stop !== undefined && char === stop)) {
        break;
      }
      if (stop === undefined && char === "}") {
        throw new MathUnsupported("unbalanced closing brace");
      }

      let base = this.atom();

      // Scripts bind to the atom just read, and may appear in either order.
      for (;;) {
        this.eatSpace();
        const next = this.peek();
        if (next === "^" || next === "_") {
          this.index += 1;
          const script = this.atom();
          const wrapper = mathEl(next === "^" ? "msup" : "msub");
          wrapper.append(base, script);
          base = wrapper;
          continue;
        }
        break;
      }

      row.append(base);
    }
    if (stop !== undefined && this.peek() !== stop) {
      throw new MathUnsupported(`expected '${stop}'`);
    }
    return row;
  }

  parse(): Element {
    const row = this.row();
    this.eatSpace();
    if (this.index < this.source.length) {
      throw new MathUnsupported("trailing input");
    }
    return row;
  }
}

/**
 * Render one math fragment.
 *
 * Falls back to the literal source in a `<code>` when the subset cannot handle
 * it, so an unsupported formula is visibly TeX rather than silently wrong.
 */
function renderMath(source: string, display: boolean): Element {
  try {
    const parsed = new MathReader(source).parse();
    const math = mathEl("math");
    math.setAttribute("display", display ? "block" : "inline");
    math.append(parsed);
    return math;
  } catch {
    const code = document.createElement("code");
    code.className = "rt-math-raw";
    code.textContent = display ? `$$${source}$$` : `$${source}$`;
    code.title = "This formula uses LaTeX beyond what this page renders; showing the source.";
    return code;
  }
}

/* -------------------------------------------------------------------------- */
/* Inline Markdown                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Inline spans, in one pass.
 *
 * Order matters: code and math are taken first and their contents are never
 * re-scanned, so `` `**not bold**` `` and `$a_b$` survive intact.
 */
export function renderInline(source: string): Node[] {
  const nodes: Node[] = [];
  let text = "";

  const flush = (): void => {
    if (text !== "") {
      nodes.push(document.createTextNode(text));
      text = "";
    }
  };

  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);

    // Escapes come first so `\*` is a literal asterisk.
    const escaped = /^\\([\\`*_~[\]()$#-])/.exec(rest);
    if (escaped) {
      text += escaped[1];
      index += escaped[0].length;
      continue;
    }

    const code = /^(`+)([\s\S]*?)\1/.exec(rest);
    if (code && code[2] !== undefined) {
      flush();
      const el = document.createElement("code");
      el.textContent = code[2].trim();
      nodes.push(el);
      index += code[0].length;
      continue;
    }

    const displayMath = /^\$\$([\s\S]+?)\$\$/.exec(rest);
    if (displayMath && displayMath[1] !== undefined) {
      flush();
      nodes.push(renderMath(displayMath[1].trim(), true));
      index += displayMath[0].length;
      continue;
    }

    // Requires a non-space next to the delimiters, so "$5 and $10" is money.
    const inlineMath = /^\$(?!\s)([^$\n]+?)(?<!\s)\$/.exec(rest);
    if (inlineMath && inlineMath[1] !== undefined) {
      flush();
      nodes.push(renderMath(inlineMath[1], false));
      index += inlineMath[0].length;
      continue;
    }

    // The URL may contain balanced parentheses — Wikipedia links do, and so
    // does `javascript:alert(1)`. Matching them keeps a stray ")" out of the
    // text and, more importantly, hands the whole scheme to safeUrl.
    const link = /^\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)/.exec(rest);
    if (link && link[1] !== undefined && link[2] !== undefined) {
      const href = safeUrl(link[2]);
      flush();
      if (href === undefined) {
        // Not a scheme we will link: keep the words, drop the target.
        nodes.push(...renderInline(link[1]));
      } else {
        const el = anchor(href, "");
        el.append(...renderInline(link[1]));
        nodes.push(el);
      }
      index += link[0].length;
      continue;
    }

    const autolink = /^<((?:https?|mailto):[^>\s]+)>/.exec(rest);
    if (autolink && autolink[1] !== undefined) {
      const href = safeUrl(autolink[1]);
      if (href !== undefined) {
        flush();
        nodes.push(anchor(href, autolink[1]));
        index += autolink[0].length;
        continue;
      }
    }

    const bareUrl = /^https?:\/\/[^\s<>()[\]]+/.exec(rest);
    if (bareUrl) {
      const href = safeUrl(bareUrl[0]);
      if (href !== undefined) {
        flush();
        nodes.push(anchor(href, bareUrl[0]));
        index += bareUrl[0].length;
        continue;
      }
    }

    // Only `**` marks strong. CommonMark also accepts `__`, but this renders
    // commit text: `__init__`, `__main__` and `__attribute__` appear far more
    // often than anyone writing bold with underscores, and mangling an
    // identifier is a worse failure than missing an emphasis nobody used.
    const atWordStart = index === 0 || /[\s([{"'—–-]$/.test(source.slice(0, index));
    const strong = /^\*\*(?=\S)([\s\S]*?\S)\*\*/.exec(rest);
    if (strong && strong[1] !== undefined) {
      flush();
      const el = document.createElement("strong");
      el.append(...renderInline(strong[1]));
      nodes.push(el);
      index += strong[0].length;
      continue;
    }

    const strike = /^~~(?=\S)([\s\S]*?\S)~~/.exec(rest);
    if (strike && strike[1] !== undefined) {
      flush();
      const el = document.createElement("del");
      el.append(...renderInline(strike[1]));
      nodes.push(el);
      index += strike[0].length;
      continue;
    }

    // Underscores only italicise at a word boundary, so snake_case_names and
    // `__init__` are left alone.
    const emphasis = /^\*(?=\S)([\s\S]*?\S)\*/.exec(rest)
      ?? (atWordStart ? /^_(?=\S)([^_]*?\S)_(?![A-Za-z0-9_])/.exec(rest) : null);
    if (emphasis && emphasis[1] !== undefined) {
      flush();
      const el = document.createElement("em");
      el.append(...renderInline(emphasis[1]));
      nodes.push(el);
      index += emphasis[0].length;
      continue;
    }

    text += source[index];
    index += 1;
  }

  flush();
  return nodes;
}

/* -------------------------------------------------------------------------- */
/* Block Markdown                                                              */
/* -------------------------------------------------------------------------- */

function listItems(lines: string[], ordered: boolean): HTMLElement {
  const list = document.createElement(ordered ? "ol" : "ul");
  const marker = ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/;
  let current: string[] = [];

  const commit = (): void => {
    if (current.length === 0) {
      return;
    }
    const item = document.createElement("li");
    item.append(...renderInline(current.join(" ").trim()));
    list.appendChild(item);
    current = [];
  };

  for (const line of lines) {
    if (marker.test(line)) {
      commit();
      current.push(line.replace(marker, ""));
    } else {
      // A continuation line of the item above.
      current.push(line.trim());
    }
  }
  commit();
  return list;
}

/**
 * Render a Markdown document into a fragment.
 *
 * Block structure is line-based, which is all the commit bodies in this data
 * need; nested lists and tables are deliberately out of scope and degrade to
 * paragraphs rather than failing.
 */
export function renderMarkdown(source: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");

  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    // Fenced code. Everything inside is literal, including Markdown.
    const fence = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence && fence[1] !== undefined) {
      const closing = fence[1];
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trimStart().startsWith(closing)) {
        body.push(lines[index] ?? "");
        index += 1;
      }
      index += 1; // closing fence, or end of input
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = body.join("\n");
      pre.appendChild(code);
      fragment.appendChild(pre);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading && heading[1] !== undefined && heading[2] !== undefined) {
      // Clamped to h4–h6: a commit card sits inside a page that already owns
      // h1–h3, and jumping the outline would be a real accessibility problem.
      const level = Math.min(6, Math.max(4, heading[1].length + 3));
      const el = document.createElement(`h${level}`);
      el.append(...renderInline(heading[2]));
      fragment.appendChild(el);
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (index < lines.length && /^\s*>/.test(lines[index] ?? "")) {
        body.push((lines[index] ?? "").replace(/^\s*>\s?/, ""));
        index += 1;
      }
      const quote = document.createElement("blockquote");
      quote.appendChild(renderMarkdown(body.join("\n")));
      fragment.appendChild(quote);
      continue;
    }

    const bullet = /^\s*[-*+]\s+/.test(line);
    const numbered = /^\s*\d+[.)]\s+/.test(line);
    if (bullet || numbered) {
      const marker = bullet ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;
      const body: string[] = [];
      while (index < lines.length) {
        const candidate = lines[index] ?? "";
        if (candidate.trim() === "") {
          break;
        }
        if (!marker.test(candidate) && !/^\s+\S/.test(candidate)) {
          break;
        }
        body.push(candidate);
        index += 1;
      }
      fragment.appendChild(listItems(body, numbered));
      continue;
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      fragment.appendChild(document.createElement("hr"));
      index += 1;
      continue;
    }

    // Paragraph: run to the next blank line or block opener.
    const body: string[] = [];
    while (index < lines.length) {
      const candidate = lines[index] ?? "";
      if (
        candidate.trim() === ""
        || /^\s*(`{3,}|~{3,})/.test(candidate)
        || /^#{1,6}\s/.test(candidate)
        || /^\s*>/.test(candidate)
        || /^\s*[-*+]\s+/.test(candidate)
        || /^\s*\d+[.)]\s+/.test(candidate)
      ) {
        break;
      }
      body.push(candidate);
      index += 1;
    }
    const paragraph = document.createElement("p");
    paragraph.append(...renderInline(body.join("\n").trim()));
    fragment.appendChild(paragraph);
  }

  return fragment;
}

/**
 * Plain text of a Markdown source, for places that need one line.
 *
 * Used for the collapsed row and for `aria-label`s, where markup would be noise
 * rather than meaning.
 */
export function markdownToText(source: string): string {
  const holder = document.createElement("div");
  holder.appendChild(renderMarkdown(source));
  // Joined per block rather than reading textContent off the wrapper: that
  // concatenates with no separator, so a heading ran into the paragraph under
  // it as "TitleSome text".
  return Array.from(holder.childNodes)
    .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
    .filter((text) => text !== "")
    .join(" ")
    .trim();
}
