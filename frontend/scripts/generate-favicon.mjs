/**
 * Genere public/favicon.svg : un monogramme "U" en ruban, dessine comme une
 * forme fermee (fill) a largeur variable plutot qu'un simple stroke SVG -
 * SVG ne sait pas faire varier stroke-width le long d'un trace, donc la
 * seule facon d'avoir un ruban fin aux extremites et epais au centre est de
 * calculer soi-meme le contour gauche/droit autour d'une ligne centrale.
 *
 * Pourquoi un script plutot qu'un SVG ecrit a la main : le contour final
 * est un polygone de plusieurs centaines de points (echantillonnage dense
 * de la ligne centrale + bouchons arrondis aux extremites), illisible et
 * ingerable a la main. Ne retoucher QUE les constantes ci-dessous
 * (trace de la ligne centrale, epaisseurs, couleurs) puis relancer
 * `npm run favicon` - ne jamais editer public/favicon.svg directement, il
 * serait ecrase au prochain lancement.
 *
 * Design (valide en session, voir issue #19) : un "U" asymetrique - la
 * branche gauche est droite et volontairement plus longue, la branche
 * droite se courbe et "s'echappe" vers l'exterieur du cadre, comme une
 * route qui continue au-dela du monogramme plutot qu'une simple lettre
 * figee.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(rootDir, '..', 'public', 'favicon.svg');

// Couleurs de la charte graphique (src/styles/tokens.css, issue #52) :
// --color-primary (fond) et --color-on-primary (glyphe), memes valeurs
// dupliquees ici volontairement - un script Node ne peut pas lire une
// variable CSS custom property, donc a resynchroniser a la main si la
// charte change (voir aussi la meme convention de duplication assumee
// dans src/lib/profile.ts pour TRANSPORT_MODES).
const COLOR_BACKGROUND = '#f5a623';
const COLOR_GLYPH = '#241a00';

// Ligne centrale du ruban, decoupee en segments L (ligne) / C (cubique)
// pour pouvoir echantillonner position + tangente tout le long. Coordonnees
// dans un viewBox 0 0 100 100.
const segments = [
  // Branche gauche : droite et volontairement plus longue que la branche
  // droite (asymetrie voulue, voir le commentaire d'en-tete).
  { type: 'L', from: [34, 17], to: [34, 58] },
  // Base du U (transition entre les deux branches).
  { type: 'C', from: [34, 58], cp1: [34, 71], cp2: [41, 78], to: [50, 78] },
  { type: 'C', from: [50, 78], cp1: [59, 78], cp2: [66, 71], to: [66, 58] },
  // Branche droite : montee, puis bascule en courbe vers l'exterieur.
  { type: 'L', from: [66, 58], to: [66, 39] },
  { type: 'C', from: [66, 39], cp1: [66, 32], cp2: [67, 26], to: [70, 25] },
];

// Densite d'echantillonnage de la ligne centrale (par segment). Assez eleve
// pour qu'une fois relie par des lignes droites, le contour paraisse lisse
// au rendu (pas besoin de reconstruire de vraies courbes de Bezier pour le
// contour final).
const SAMPLES_PER_SEGMENT = 40;

// Demi-largeur du ruban : fine aux deux extremites (t=0 et t=1 sur la
// ligne centrale), pleine au centre du trait - degrade en cloche via
// sinus (voir halfWidthAt). Rayon des bouchons arrondis aux extremites =
// MIN_HALF_WIDTH (donc coherent avec l'epaisseur locale a cet endroit).
const MIN_HALF_WIDTH = 2.5;
const MAX_HALF_WIDTH = 6.5;

function evalLine(seg, u) {
  const [x0, y0] = seg.from;
  const [x1, y1] = seg.to;
  const pos = [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
  const tangent = normalize([x1 - x0, y1 - y0]);
  return { pos, tangent };
}

function evalCubic(seg, u) {
  const [p0, p1, p2, p3] = [seg.from, seg.cp1, seg.cp2, seg.to];
  const mu = 1 - u;
  // Position : formule de Bezier cubique standard.
  const pos = [0, 1].map(
    (i) =>
      mu ** 3 * p0[i] +
      3 * mu ** 2 * u * p1[i] +
      3 * mu * u ** 2 * p2[i] +
      u ** 3 * p3[i],
  );
  // Tangente : derivee de la meme cubique.
  const deriv = [0, 1].map(
    (i) =>
      3 * mu ** 2 * (p1[i] - p0[i]) +
      6 * mu * u * (p2[i] - p1[i]) +
      3 * u ** 2 * (p3[i] - p2[i]),
  );
  return { pos, tangent: normalize(deriv) };
}

function normalize([x, y]) {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
}

// Normale = tangente tournee de 90 degres. Le sens de rotation (-ty, tx)
// doit rester le MEME sur tout le trace, sinon le ruban se "vrille" a un
// endroit (le cote gauche/droit s'inverserait en cours de route).
function normalFrom(tangent) {
  const [tx, ty] = tangent;
  return [-ty, tx];
}

function angleOf([x, y]) {
  return Math.atan2(y, x);
}

// Points d'un arc de cercle entre deux angles, par interpolation lineaire
// (le sens - croissant ou decroissant - est donne par angleTo - angleFrom).
function arcPoints(center, radius, angleFrom, angleTo, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = angleFrom + (angleTo - angleFrom) * (i / steps);
    pts.push([center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)]);
  }
  return pts;
}

// 1) Echantillonnage dense de toute la ligne centrale (position + tangente
// a chaque point).
const rawSamples = [];
for (const seg of segments) {
  for (let i = 0; i <= SAMPLES_PER_SEGMENT; i++) {
    const u = i / SAMPLES_PER_SEGMENT;
    const { pos, tangent } = seg.type === 'L' ? evalLine(seg, u) : evalCubic(seg, u);
    rawSamples.push({ pos, tangent });
  }
}

// 2) Longueur d'arc cumulee : le degrade d'epaisseur doit suivre la
// distance reellement parcourue, pas l'indice d'echantillon (les segments
// n'ont pas tous la meme longueur).
let cumLength = 0;
const samples = rawSamples.map((s, i) => {
  if (i > 0) {
    const prev = rawSamples[i - 1].pos;
    cumLength += Math.hypot(s.pos[0] - prev[0], s.pos[1] - prev[1]);
  }
  return { ...s, cumLength };
});
const totalLength = cumLength;

function halfWidthAt(t) {
  return MIN_HALF_WIDTH + (MAX_HALF_WIDTH - MIN_HALF_WIDTH) * Math.sin(Math.PI * t);
}

// 3) Contours gauche/droit du ruban : chaque point de la ligne centrale est
// decale perpendiculairement (le long de sa normale) de la demi-largeur
// locale, de part et d'autre.
const left = [];
const right = [];
for (const s of samples) {
  const t = s.cumLength / totalLength;
  const hw = halfWidthAt(t);
  const [nx, ny] = normalFrom(s.tangent);
  left.push([s.pos[0] + nx * hw, s.pos[1] + ny * hw]);
  right.push([s.pos[0] - nx * hw, s.pos[1] - ny * hw]);
}

// 4) Bouchons arrondis aux deux extremites (demi-cercle centre sur le point
// de la ligne centrale, rayon = demi-largeur locale) plutot que la coupe
// plate obtenue en reliant directement left[0] a right[0].
const CAP_STEPS = 12;
const first = samples[0];
const last = samples[samples.length - 1];
const hwStart = halfWidthAt(0);
const hwEnd = halfWidthAt(1);
const angleNormalStart = angleOf(normalFrom(first.tangent));
const angleNormalEnd = angleOf(normalFrom(last.tangent));

// Bouchon de fin (t=1) : balaie de l'angle de left[last] vers celui de
// right[last] en passant par +tangente(1), donc le bouchon continue "vers
// l'avant" dans le sens du trace plutot que de couper la ligne a angle droit.
const capEnd = arcPoints(last.pos, hwEnd, angleNormalEnd, angleNormalEnd - Math.PI, CAP_STEPS);

// Bouchon de debut (t=0) : meme logique, mais vers l'arriere (-tangente(0)).
const capStart = arcPoints(
  first.pos,
  hwStart,
  angleNormalStart + Math.PI,
  angleNormalStart,
  CAP_STEPS,
);

// 5) Polygone ferme : bord gauche (t=0->1), bouchon de fin, bord droit
// (t=1->0), bouchon de debut. Les points dupliques aux jonctions (le
// premier point d'un bouchon coincide avec le dernier point du bord
// precedent) sont sans consequence sur un polygone rempli : ils ne
// produisent qu'un segment de longueur nulle.
const points = [...left, ...capEnd.slice(1), ...right.slice().reverse(), ...capStart.slice(1, -1)];

const pathData =
  `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)} ` +
  points
    .slice(1)
    .map((p) => `L ${p[0].toFixed(2)} ${p[1].toFixed(2)}`)
    .join(' ') +
  ' Z';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!--
    Genere par scripts/generate-favicon.mjs - NE PAS EDITER A LA MAIN, les
    modifications seraient ecrasees au prochain lancement de
    "npm run favicon". Retoucher les constantes du script puis relancer.
  -->
  <rect width="100" height="100" rx="22" fill="${COLOR_BACKGROUND}" />
  <path d="${pathData}" fill="${COLOR_GLYPH}" />
</svg>
`;

await writeFile(outputPath, svg);
console.log(`✓ ${path.relative(process.cwd(), outputPath)} généré`);
