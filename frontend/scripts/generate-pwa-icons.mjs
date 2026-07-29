/**
 * Genere les icones PNG utilisees par le manifest PWA (public/pwa-*.png) et
 * l'icone iOS (public/apple-touch-icon.png) a partir de la source vectorielle
 * unique public/favicon.svg.
 *
 * Un seul fichier source a maintenir : si la charte graphique change de
 * couleur primaire (src/styles/tokens.css), il suffit de mettre a jour le
 * SVG puis de relancer ce script (`npm run icons`) plutot que de retoucher
 * chaque PNG a la main.
 *
 * Sharp est un devDependency (pas une dependance d'app) : uniquement utilise
 * au moment du build de ces assets, jamais importe par le code applicatif.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(rootDir, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');

/**
 * Description d'un PNG a generer : nom de fichier, taille (carre) et, pour
 * l'icone maskable, une consigne de securite (le SVG source est deja dessine
 * pour respecter la zone de securite des icones maskables - voir le
 * commentaire dans favicon.svg).
 */
const TARGETS = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  // Apple ignore le manifest web (icons/theme_color) : iOS lit uniquement
  // <link rel="apple-touch-icon">, d'ou une icone dediee (voir index.html).
  { file: 'apple-touch-icon.png', size: 180 },
];

async function main() {
  const svgBuffer = await readFile(svgPath);

  for (const { file, size } of TARGETS) {
    const outputPath = path.join(publicDir, file);
    await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
    console.log(`✓ ${file} (${size}×${size})`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
