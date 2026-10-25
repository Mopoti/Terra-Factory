// Copie les .glb exportés de Blender (export/) vers les ressources du jeu (public/models/terra/).
// Usage : node scripts/sync-modeles.mjs
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';

mkdirSync('public/models/terra', { recursive: true });
const files = readdirSync('export').filter((f) => f.endsWith('.glb'));
for (const f of files) copyFileSync(`export/${f}`, `public/models/terra/${f}`);
console.log(`${files.length} modèle(s) copié(s) dans public/models/terra/`);
