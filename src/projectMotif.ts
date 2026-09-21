/**
 * A quiet, per-project background behind each project-page hero.
 *
 * Requested directly: "text, backgrounds, or animations which look like the
 * project" — evidence-flavoured decoration, not the generic motion this site
 * otherwise deliberately avoids (DESIGN.md warns against exactly the
 * "pulsing indicator" and "stagger-spam" patterns this is not). The
 * mechanism stays identical across every project — one repeating SVG
 * `<pattern>` tile with a single line quietly animating its own
 * `stroke-dashoffset`, so the whole texture reads as one coherent surface
 * rather than several looping elements drawing attention independently —
 * and only the five small tile path-sets below change per project, each
 * echoing what that project actually is rather than illustrating it
 * literally:
 *
 *   circuit  (Flinstone)         — PCB-style traces: a kernel is hardware.
 *   network  (Homework Central)  — connected nodes: a community platform.
 *   gate     (QPU)                — a wire with gate boxes: a circuit diagram.
 *   tree     (KeyQuorum)          — a branching tree: the M-of-N share tree
 *                                   the project actually implements.
 *   pulse    (EMR)                — an ECG line: the one project restrained
 *                                   enough to earn a literal nod (medical).
 *
 * Opacity stays low (~10%) and the layer is `aria-hidden` with no pointer
 * events, so it never competes with the hero's actual text or controls, and
 * — like every other animation on this site — inherits the sitewide
 * `prefers-reduced-motion` rule rather than needing its own guard.
 */

type MotifKey = "circuit" | "network" | "gate" | "tree" | "pulse";

const TILE_SIZE = 40;

/**
 * Each tile is drawn in a 40×40 user-space box. `flow` is the one path per
 * tile whose dash animates; everything else in `paths` is static line art.
 * Colour comes entirely from `currentColor` on the mount point, so a single
 * CSS custom property controls every motif without this module knowing
 * about the design system's tokens.
 */
const TILES: Record<MotifKey, { paths: readonly string[]; flow: string; flowLength: number }> = {
  circuit: {
    paths: ["M4 4 H20 V20 H36", "M36 4 H28", "M4 36 H12 V28"],
    flow: "M4 4 H20 V20 H36",
    flowLength: 48,
  },
  network: {
    paths: ["M8 8 L30 12 L18 32 Z", "M8 8 L18 32"],
    flow: "M8 8 L30 12 L18 32 Z",
    flowLength: 62,
  },
  gate: {
    paths: ["M0 20 H40", "M14 14 H22 V26 H14 Z", "M28 10 V30"],
    flow: "M0 20 H40",
    flowLength: 40,
  },
  tree: {
    paths: ["M20 2 V14", "M20 14 L8 24 V38", "M20 14 L32 24 V38", "M8 24 L2 32", "M32 24 L38 32"],
    flow: "M20 2 V14 M20 14 L8 24 V38",
    flowLength: 46,
  },
  pulse: {
    paths: ["M0 24 H10 L14 8 L20 34 L24 24 H40"],
    flow: "M0 24 H10 L14 8 L20 34 L24 24 H40",
    flowLength: 60,
  },
};

function isMotifKey(value: string): value is MotifKey {
  return Object.prototype.hasOwnProperty.call(TILES, value);
}

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag);
}

function renderMotif(mount: HTMLElement, key: MotifKey): void {
  const tile = TILES[key];
  const patternId = `project-motif-${key}`;

  const svg = svgEl("svg");
  svg.setAttribute("class", "project-motif");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");

  const defs = svgEl("defs");
  const pattern = svgEl("pattern");
  pattern.setAttribute("id", patternId);
  pattern.setAttribute("width", String(TILE_SIZE));
  pattern.setAttribute("height", String(TILE_SIZE));
  pattern.setAttribute("patternUnits", "userSpaceOnUse");

  for (const d of tile.paths) {
    const path = svgEl("path");
    path.setAttribute("d", d);
    path.setAttribute("class", "project-motif-line");
    pattern.appendChild(path);
  }

  const flowPath = svgEl("path");
  flowPath.setAttribute("d", tile.flow);
  flowPath.setAttribute("class", "project-motif-line project-motif-flow");
  flowPath.style.setProperty("--motif-flow-length", String(tile.flowLength));
  pattern.appendChild(flowPath);

  defs.appendChild(pattern);
  svg.appendChild(defs);

  const rect = svgEl("rect");
  rect.setAttribute("width", "100%");
  rect.setAttribute("height", "100%");
  rect.setAttribute("fill", `url(#${patternId})`);
  svg.appendChild(rect);

  mount.appendChild(svg);
}

export function mountProjectMotifs(): void {
  document.querySelectorAll<HTMLElement>("[data-project-motif]").forEach((mount) => {
    const key = mount.getAttribute("data-project-motif") ?? "";
    if (isMotifKey(key)) {
      renderMotif(mount, key);
    }
  });
}
