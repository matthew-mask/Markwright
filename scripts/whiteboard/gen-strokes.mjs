// Usage: node scripts/whiteboard/gen-strokes.mjs  → the --wb-* custom properties to paste into
// the [data-theme="whiteboard"] block of src/renderer/styles/themes/whiteboard.css.
// Generates hand-drawn marker strokes for the Whiteboard theme as CSS custom
// properties. Each stroke is a thin SVG strip stretched along one axis
// (preserveAspectRatio='none' + non-scaling-stroke), so the wobble stays a
// constant few pixels across the strip while the line spans any length.
let seed = 29;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const rf = (a, b) => +(a + rand() * (b - a)).toFixed(1);

// A hand-drawn line along the long axis (0..1000): it drifts from one side of
// the strip to the other and bows a little, the way a marker line does.
function wobble(mid, amp, from, to) {
  const segs = 2;
  const step = (to - from) / segs;
  const clamp = (v) => Math.min(mid + amp, Math.max(mid - amp, v));
  const tilt = rf(-amp * 0.8, amp * 0.8);
  let y = clamp(mid - tilt / 2 + rf(-0.4, 0.4));
  let d = `M${from} ${y.toFixed(1)}`;
  for (let i = 1; i <= segs; i++) {
    const x = from + step * i;
    const yEnd = clamp(mid - tilt / 2 + (tilt * i) / segs + rf(-0.6, 0.6));
    const bow = rf(-amp, amp);
    d += ` C${(x - step * 0.66).toFixed(1)} ${clamp(y + bow).toFixed(1)} ${(x - step * 0.33).toFixed(1)} ${clamp(yEnd + bow * 0.8).toFixed(1)} ${x.toFixed(1)} ${yEnd.toFixed(1)}`;
    y = yEnd;
  }
  return d;
}

// Swap x/y in a path built for a horizontal strip.
const transpose = (d) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, '$2 $1');

function strip({ dir, color, width, cross = 10, amp = 2.4, double = false }) {
  const mid = cross / 2;
  const main = wobble(mid, amp, rf(2, 7), rf(993, 998));
  // A partial second pass, like going back over a line with the marker.
  const second = wobble(mid + (rand() < 0.5 ? -0.6 : 0.6), amp * 0.8, rf(30, 260), rf(700, 975));
  const passes = [
    [main, color, width],
    [second, color.replace(/[\d.]+\)$/, (a) => `${(parseFloat(a) * (double ? 0.85 : 0.32)).toFixed(2)})`), +(width * (double ? 0.9 : 0.75)).toFixed(2)]
  ];
  const vb = dir === 'h' ? `0 0 1000 ${cross}` : `0 0 ${cross} 1000`;
  const paths = passes
    .map(
      ([d, c, w]) =>
        `<path d='${dir === 'h' ? d : transpose(d)}' stroke='${c}' stroke-width='${w}' stroke-linecap='round' fill='none' vector-effect='non-scaling-stroke'/>`
    )
    .join('');
  return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' preserveAspectRatio='none'>${paths}</svg>")`;
}

const INK = 'rgba(36,39,43,0.82)';
const GREEN = 'rgba(29,127,62,0.85)';
const BLUE = 'rgba(31,79,163,0.8)';
const GREY = 'rgba(150,157,165,0.7)';

const vars = {
  'h-ink-1': strip({ dir: 'h', color: INK, width: 2.2 }),
  'h-ink-2': strip({ dir: 'h', color: INK, width: 2.2 }),
  'h-ink-3': strip({ dir: 'h', color: INK, width: 2.2 }),
  'v-ink-1': strip({ dir: 'v', color: INK, width: 2.2 }),
  'v-ink-2': strip({ dir: 'v', color: INK, width: 2.2 }),
  'v-ink-3': strip({ dir: 'v', color: INK, width: 2.2 }),
  'h-ink-double': strip({ dir: 'h', color: INK, width: 2.4, double: true }),
  'h-green-1': strip({ dir: 'h', color: GREEN, width: 2.2 }),
  'h-green-2': strip({ dir: 'h', color: GREEN, width: 2.2 }),
  'v-green-1': strip({ dir: 'v', color: GREEN, width: 3.4 }),
  'v-green-2': strip({ dir: 'v', color: GREEN, width: 2.2 }),
  'h-blue-thick': strip({ dir: 'h', color: BLUE, width: 3.6, cross: 12, amp: 3 }),
  'h-grey': strip({ dir: 'h', color: GREY, width: 2 }),
  'v-grey': strip({ dir: 'v', color: GREY, width: 2 }),
  check: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><path d='M3.5 10.8 C5.5 12.4 7 14.2 8.2 16 C10.5 11 13.4 7.2 17 3.6' stroke='rgba(29,127,62,0.95)' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>")`
};


// ---- sketched shapes (buttons, tabs, checkboxes) ----------------------------
// One marker loop around the box that overlaps where it started, plus an
// optional fill that follows the same wobbly outline. Stretched to the
// element; the stroke stays a constant width.
const f1 = (n) => n.toFixed(1);
function sketchRect({ w, h, r, m = 2.5, bow = 0.9, stroke, width = 2, fill, dash, overshoot = true }) {
  const j = (a = 0.6) => rf(-a, a);
  const b = () => rf(-bow, bow);
  const pts = {
    tl: [r + j(), m + j(0.4)],
    tr: [w - r + j(), m + j(0.4)],
    rt: [w - m + j(0.4), r + j()],
    rb: [w - m + j(0.4), h - r + j()],
    br: [w - r + j(), h - m + j(0.4)],
    bl: [r + j(), h - m + j(0.4)],
    lb: [m + j(0.4), h - r + j()],
    lt: [m + j(0.4), r + j()]
  };
  const edge = ([x1, y1], [x2, y2], horizontal) =>
    horizontal
      ? ` C${f1(x1 + (x2 - x1) / 3)} ${f1(y1 + b())} ${f1(x1 + ((x2 - x1) * 2) / 3)} ${f1(y2 + b())} ${f1(x2)} ${f1(y2)}`
      : ` C${f1(x1 + b())} ${f1(y1 + (y2 - y1) / 3)} ${f1(x2 + b())} ${f1(y1 + ((y2 - y1) * 2) / 3)} ${f1(x2)} ${f1(y2)}`;
  const corner = ([cx, cy], [x, y]) => ` Q${f1(cx)} ${f1(cy)} ${f1(x)} ${f1(y)}`;
  let d = `M${f1(pts.tl[0])} ${f1(pts.tl[1])}`;
  d += edge(pts.tl, pts.tr, true) + corner([w - m, m], pts.rt);
  d += edge(pts.rt, pts.rb, false) + corner([w - m, h - m], pts.br);
  d += edge(pts.br, pts.bl, true) + corner([m, h - m], pts.lb);
  d += edge(pts.lb, pts.lt, false) + corner([m, m], pts.tl);
  const closed = d + ' Z';
  if (overshoot) d += edge(pts.tl, [pts.tl[0] + w * rf(0.12, 0.22), pts.tl[1] + j(0.8)], true);
  const layers = [];
  if (fill) layers.push(`<path d='${closed}' fill='${fill}'/>`);
  if (stroke)
    layers.push(
      `<path d='${d}' stroke='${stroke}' stroke-width='${width}' stroke-linecap='round' stroke-linejoin='round' fill='none' vector-effect='non-scaling-stroke'${dash ? ` stroke-dasharray='${dash}'` : ''}/>`
    );
  return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>${layers.join('')}</svg>")`;
}

// A loop drawn round past its start, for round buttons.
function sketchCircle({ size = 40, stroke, width = 2, fill }) {
  const c = size / 2;
  const pts = [];
  const start = rf(-120, -80);
  for (let a = 0; a <= 400; a += 40) {
    const rad = ((start + a) * Math.PI) / 180;
    const radius = c - 3 - (a > 360 ? 1.6 : 0) + rf(-1.4, 1.4);
    pts.push([c + radius * Math.cos(rad), c + radius * Math.sin(rad)]);
  }
  // Catmull-Rom through the points, as cubic Beziers.
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  const layers = [];
  if (fill) layers.push(`<circle cx='${c}' cy='${c}' r='${c - 3}' fill='${fill}'/>`);
  layers.push(`<path d='${d}' stroke='${stroke}' stroke-width='${width}' stroke-linecap='round' fill='none' vector-effect='non-scaling-stroke'/>`);
  return `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${size} ${size}' preserveAspectRatio='none'>${layers.join('')}</svg>")`;
}

Object.assign(vars, {
  'h-blue-1': strip({ dir: 'h', color: BLUE, width: 2.4 }),
  'h-blue-2': strip({ dir: 'h', color: BLUE, width: 2.4 }),
  'v-blue-1': strip({ dir: 'v', color: BLUE, width: 2.4 }),
  'v-blue-2': strip({ dir: 'v', color: BLUE, width: 2.4 }),
  'box-btn': sketchRect({ w: 100, h: 40, r: 10, m: 3.4, bow: 2.4, stroke: INK, fill: 'rgba(255,255,255,0.92)' }),
  'box-btn-hover': sketchRect({ w: 100, h: 40, r: 10, m: 3.4, bow: 2.4, stroke: INK, fill: 'rgba(228,236,248,0.95)' }),
  'box-accent': sketchRect({ w: 100, h: 40, r: 10, m: 3.4, bow: 2.4, stroke: 'rgba(22,58,124,0.95)', fill: 'rgba(31,79,163,1)' }),
  'box-dashed': sketchRect({ w: 100, h: 40, r: 10, m: 3.4, bow: 2.4, stroke: 'rgba(36,39,43,0.45)', dash: '5 4', overshoot: false }),
  'circle-btn': sketchCircle({ stroke: INK, fill: 'rgba(255,255,255,0.92)' }),
  'circle-btn-hover': sketchCircle({ stroke: INK, fill: 'rgba(228,236,248,0.95)' }),
  'hl-active': sketchRect({ w: 100, h: 30, r: 8, m: 2.5, bow: 3, fill: 'rgba(31,79,163,0.11)' }),
  'hl-hover': sketchRect({ w: 100, h: 30, r: 8, m: 2.5, bow: 3, fill: 'rgba(31,79,163,0.06)' }),
  'box-check': sketchRect({ w: 20, h: 20, r: 3, m: 1.8, bow: 0.5, stroke: INK, width: 2 })
});

process.stdout.write(
  Object.entries(vars)
    .map(([k, v]) => `  --wb-${k}: ${v};`)
    .join('\n')
);
