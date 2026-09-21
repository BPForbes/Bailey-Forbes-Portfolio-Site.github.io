const TILE_SIZE = 40;
const TILES = {
  circuit: {
    paths: ["M4 4 H20 V20 H36", "M36 4 H28", "M4 36 H12 V28"],
    flow: "M4 4 H20 V20 H36",
    flowLength: 48
  },
  network: {
    paths: ["M8 8 L30 12 L18 32 Z", "M8 8 L18 32"],
    flow: "M8 8 L30 12 L18 32 Z",
    flowLength: 62
  },
  gate: {
    paths: ["M0 20 H40", "M14 14 H22 V26 H14 Z", "M28 10 V30"],
    flow: "M0 20 H40",
    flowLength: 40
  },
  tree: {
    paths: ["M20 2 V14", "M20 14 L8 24 V38", "M20 14 L32 24 V38", "M8 24 L2 32", "M32 24 L38 32"],
    flow: "M20 2 V14 M20 14 L8 24 V38",
    flowLength: 46
  },
  pulse: {
    paths: ["M0 24 H10 L14 8 L20 34 L24 24 H40"],
    flow: "M0 24 H10 L14 8 L20 34 L24 24 H40",
    flowLength: 60
  }
};
function isMotifKey(value) {
  return Object.prototype.hasOwnProperty.call(TILES, value);
}
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag) {
  return document.createElementNS(SVG_NS, tag);
}
function renderMotif(mount, key) {
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
function mountProjectMotifs() {
  document.querySelectorAll("[data-project-motif]").forEach((mount) => {
    const key = mount.getAttribute("data-project-motif") ?? "";
    if (isMotifKey(key)) {
      renderMotif(mount, key);
    }
  });
}
export {
  mountProjectMotifs
};
