// Generates the Whiteboard theme's erased-board background (the `.mw-bg-decoration`
// image in src/renderer/styles/themes/whiteboard.css).
// Usage: node scripts/whiteboard/gen-erase-marks.mjs --css  → a url("data:...") value to paste in.
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const r = (a, b) => Math.round(a + rand() * (b - a));

// A scribbled "word": arches and the occasional tall loop, like cursive at a blur.
function word(x, y, letters) {
  let d = `M${x} ${y}`;
  for (let i = 0; i < letters; i++) {
    const w = r(10, 17);
    const tall = rand() < 0.22;
    const h = tall ? r(30, 42) : r(12, 20);
    if (tall) d += ` c${r(2, 6)} -${h} ${w + 4} -${h} ${w - 2} 0`;
    else d += ` q${Math.round(w / 2)} -${h} ${w} 0`;
  }
  return d;
}

function line(x, y, words, slope) {
  let d = '';
  for (let i = 0; i < words; i++) {
    const letters = r(3, 7);
    d += word(x, y, letters) + ' ';
    x += letters * 14 + r(18, 30);
    y += Math.round(slope * 60);
  }
  return d.trim();
}

const ghostWriting = [
  // a heading and a few lines of notes, upper left
  { d: line(170, 150, 3, -0.02), w: 5, c: '40,70,150' },
  { d: line(190, 215, 5, 0.01), w: 3.5, c: '60,64,70' },
  { d: line(190, 265, 4, 0.0), w: 3.5, c: '60,64,70' },
  { d: line(190, 315, 6, 0.015), w: 3.5, c: '60,64,70' },
  // notes lower right
  { d: line(980, 640, 4, -0.01), w: 3.5, c: '60,64,70' },
  { d: line(1000, 690, 3, 0.0), w: 3.5, c: '170,50,45' },
  { d: line(990, 740, 5, 0.01), w: 3.5, c: '60,64,70' },
  // a short line mid-left
  { d: line(260, 760, 3, 0.02), w: 3.5, c: '35,120,60' }
];

const ghostShapes = [
  // box → arrow → box diagram, upper right
  { d: 'M1010 170 q-4 -2 4 -40 l220 6 q8 2 6 30 l-4 74 q-2 6 -12 6 l-210 -4 q-8 0 -6 -10 z', w: 4, c: '40,70,150' },
  { d: 'M1236 210 c40 4 70 2 112 -4 m-22 -18 l24 16 l-26 14', w: 4, c: '40,70,150' },
  { d: 'M1356 150 q0 -12 14 -12 l150 4 q12 2 10 16 l-2 96 q0 12 -14 12 l-146 -2 q-14 0 -12 -14 z', w: 4, c: '40,70,150' },
  // circled item + underline, mid
  { d: 'M640 470 c-90 -6 -130 40 -100 70 c40 36 220 30 250 -6 c26 -34 -40 -66 -170 -62', w: 3.5, c: '170,50,45' },
  { d: 'M560 600 c60 6 140 -4 230 2', w: 4, c: '170,50,45' },
  // check marks beside the lower-right notes
  { d: 'M940 632 l10 12 l20 -26 M944 734 l10 12 l20 -26', w: 4, c: '35,120,60' }
];

// Broad eraser swipes: wide, back-and-forth arcs left where things were wiped.
const swipes = [
  'M120 170 C380 120 640 250 930 170',
  'M150 270 C420 330 700 220 960 300',
  'M960 150 C1180 110 1380 260 1560 180',
  'M980 640 C1200 600 1360 760 1540 680',
  'M480 520 C640 440 820 600 960 520',
  'M200 780 C380 720 560 840 760 760',
  'M300 420 C340 380 420 470 470 410'
];

const pathEls = (items, opacity) =>
  items
    .map(
      (p) =>
        `<path d='${p.d}' stroke='rgba(${p.c},${opacity})' stroke-width='${p.w}' stroke-linecap='round' stroke-linejoin='round' fill='none'/>`
    )
    .join('');

const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000' viewBox='0 0 1600 1000'>
<defs>
<filter id='haze' x='0' y='0' width='100%' height='100%'>
<feTurbulence type='fractalNoise' baseFrequency='0.0028' numOctaves='3' seed='2'/>
<feColorMatrix type='matrix' values='0 0 0 0 0.33 0 0 0 0 0.36 0 0 0 0 0.4 0 0 0 0.34 -0.14'/>
</filter>
<filter id='wipe' x='-15%' y='-30%' width='130%' height='160%'>
<feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='2' seed='5' result='warp'/>
<feDisplacementMap in='SourceGraphic' in2='warp' scale='70' xChannelSelector='R' yChannelSelector='G' result='wobbly'/>
<feTurbulence type='fractalNoise' baseFrequency='0.003 0.14' numOctaves='3' seed='7' result='n'/>
<feColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3 -1.2' result='m'/>
<feComposite in='wobbly' in2='m' operator='in' result='c'/>
<feGaussianBlur in='c' stdDeviation='4'/>
</filter>
<filter id='ghost' x='-10%' y='-10%' width='120%' height='120%'>
<feTurbulence type='fractalNoise' baseFrequency='0.03' numOctaves='2' seed='9' result='warp'/>
<feDisplacementMap in='SourceGraphic' in2='warp' scale='8' xChannelSelector='R' yChannelSelector='G' result='wobbly'/>
<feTurbulence type='fractalNoise' baseFrequency='0.012 0.06' numOctaves='2' seed='3' result='n'/>
<feColorMatrix in='n' type='matrix' values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.2 -1.25' result='m'/>
<feComposite in='wobbly' in2='m' operator='in' result='c'/>
<feGaussianBlur in='c' stdDeviation='2.8'/>
</filter>
</defs>
<rect width='1600' height='1000' filter='url(#haze)'/>
<g filter='url(#wipe)' fill='none' stroke-linecap='round'>${swipes
  .map((d, i) => `<path d='${d}' stroke='rgba(80,88,98,0.085)' stroke-width='${[110, 90, 120, 100, 80, 95, 70][i]}'/>`)
  .join('')}</g>
<g filter='url(#ghost)'>${pathEls(ghostWriting, 0.16)}${pathEls(ghostShapes, 0.14)}</g>
</svg>`.replace(/\n/g, '');

if (process.argv.includes('--css')) {
  const encoded = svg.replace(/#/g, '%23').replace(/%(?![0-9A-F]{2})/g, '%25');
  process.stdout.write(`url("data:image/svg+xml;utf8,${encoded}")`);
} else {
  process.stdout.write(svg);
}
