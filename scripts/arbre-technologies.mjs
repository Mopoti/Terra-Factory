// Génère docs/arbre-technologies.html : l'arbre des technologies (organigramme) d'après content/techs.json.
// Usage : node scripts/arbre-technologies.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const techs = JSON.parse(readFileSync('content/techs.json', 'utf8')).techs;
const fr = JSON.parse(readFileSync('src/i18n/fr.json', 'utf8'));
const name = (id) => fr[`tech.${id}`] ?? id;
const itemName = (id) => fr[`item.${id}`] ?? id;

// Familles (couleur) : par identifiant de technologie.
const FAMILY = {
  combat: [
    'defense',
    'weapons_1',
    'armor_1a',
    'armor_1b',
    'weapons_2',
    'armor_2a',
    'armor_2b',
    'turret_2',
    'turret_3',
    'armor_4a',
    'armor_4b',
    'turret_4',
  ],
  logistique: [
    'logistics',
    'handling',
    'routing',
    'logistics_2',
    'logistics_3',
    'sorting_3',
    'automation',
  ],
  energie: [
    'electricity',
    'electricity_2',
    'power_generation',
    'power_generation_2',
    'laboratory',
    'waterwheel',
    'steam',
    'steam_power',
    'storage_3',
    'fission_4',
    'reactor_4',
    'waste_4',
    'fusion_5',
    'beacon_5',
  ],
  recherche: ['research_1', 'research_2', 'research_3', 'research_4'],
  textile: ['textile', 'clothing', 'handwear', 'bedding', 'navigation'],
};
const COLORS = {
  combat: '#d65c5c',
  logistique: '#d9a441',
  energie: '#5aa9e6',
  recherche: '#b57edc',
  textile: '#e58fb0',
  industrie: '#6fbf8a',
};
const familyOf = (id) => Object.keys(FAMILY).find((k) => FAMILY[k].includes(id)) ?? 'industrie';

const byId = new Map(techs.map((t) => [t.id, t]));
// Niveau de colonne : plus profond que tous ses prérequis (et que son palier).
const level = new Map();
const depth = (t) => {
  if (level.has(t.id)) return level.get(t.id);
  const parents = [...new Set([...t.requires, ...(t.reveal ?? [])])].filter((p) => byId.has(p));
  const d = parents.length === 0 ? 0 : 1 + Math.max(...parents.map((p) => depth(byId.get(p))));
  level.set(t.id, d);
  return d;
};
techs.forEach(depth);
const cols = [];
for (const t of techs) (cols[level.get(t.id)] ??= []).push(t);

// Couloirs : une bande horizontale par famille ; dans la bande, rangée selon la moyenne des positions des parents.
const FAMS = Object.keys(COLORS);
const row = new Map();
const bandStart = new Map();
let rows = 0;
for (const fam of FAMS) {
  bandStart.set(fam, rows);
  let need = 0;
  cols.forEach((col, c) => {
    const mine = col.filter((t) => familyOf(t.id) === fam);
    const key = (t) => {
      const ps = [...t.requires].filter((p) => row.has(p));
      return ps.length ? ps.reduce((acc, p) => acc + row.get(p), 0) / ps.length : 1e6;
    };
    mine.sort((x, y) => key(x) - key(y));
    mine.forEach((t, i) => row.set(t.id, rows + i));
    need = Math.max(need, mine.length);
  });
  rows += need;
}
const bandRows = (fam) =>
  (FAMS[FAMS.indexOf(fam) + 1] ? bandStart.get(FAMS[FAMS.indexOf(fam) + 1]) : rows) -
  bandStart.get(fam);

const W = 250,
  H = 74,
  GX = 60,
  GY = 14,
  PAD = 20,
  LANE = 26;
const bandOffset = (fam) => FAMS.indexOf(fam) * LANE;
const pos = (t) => ({
  x: PAD + level.get(t.id) * (W + GX),
  y: PAD + row.get(t.id) * (H + GY) + bandOffset(familyOf(t.id)) + LANE,
});
const width = PAD * 2 + cols.length * (W + GX) - GX;
const height = PAD * 2 + rows * (H + GY) + FAMS.length * LANE;

const costText = (t) =>
  Object.entries(t.cost)
    .map(
      ([i, n]) =>
        `${n} ${itemName(i).replace('Paquet de science', 'paquet').replace('Lingot de ', '').replace('Plaque de ', 'plaque ')}`,
    )
    .join(' + ');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

let edges = '';
for (const t of techs) {
  const to = pos(t);
  const reqs = new Set(t.requires);
  for (const p of new Set([...t.requires, ...(t.reveal ?? [])])) {
    if (!byId.has(p)) continue;
    const from = pos(byId.get(p));
    const x1 = from.x + W,
      y1 = from.y + H / 2,
      x2 = to.x,
      y2 = to.y + H / 2;
    const mx = (x1 + x2) / 2;
    edges += `<path class="edge${reqs.has(p) ? '' : ' soft'}" data-from="${p}" data-to="${t.id}" d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>\n`;
  }
}
let lanes = '';
for (const fam of FAMS) {
  const y = PAD + bandStart.get(fam) * (H + GY) + bandOffset(fam);
  const h = bandRows(fam) * (H + GY) + LANE;
  lanes += `<rect class="lane" x="0" y="${y}" width="${width}" height="${h}" style="--c:${COLORS[fam]}"/><text class="lane-t" x="${PAD}" y="${y + 17}" style="fill:${COLORS[fam]}">${fam}</text>\n`;
}
let nodes = '';
for (const t of techs) {
  const { x, y } = pos(t);
  const fam = familyOf(t.id);
  const unlocks = t.unlocks.length
    ? t.unlocks.map((u) => itemName(u)).join(', ')
    : 'Effet spécial (voir le jeu)';
  nodes += `<g class="node" data-id="${t.id}" transform="translate(${x},${y})">
  <title>${esc(name(t.id))} — palier ${t.tier}\nCoût : ${esc(costText(t))}\nDébloque : ${esc(unlocks)}</title>
  <clipPath id="c-${t.id}"><rect width="${W - 8}" height="${H}"/></clipPath>
  <rect width="${W}" height="${H}" rx="8" style="--c:${COLORS[fam]}"/>
  <g clip-path="url(#c-${t.id})">
  <text x="10" y="20" class="n">${esc(name(t.id))}</text>
  <text x="10" y="38" class="s">T${t.tier} · ${esc(costText(t))}</text>
  <text x="10" y="55" class="u">${esc(unlocks)}</text></g>
</g>\n`;
}
const legend = Object.entries(COLORS)
  .map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`)
  .join('');

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Terra Factory — arbre des technologies</title>
<style>
  :root { --bg:#10151b; --fg:#e6edf3; --muted:#8b98a5; --card:#1a222b; }
  @media (prefers-color-scheme: light) { :root { --bg:#f4f6f8; --fg:#1b2530; --muted:#5b6875; --card:#ffffff; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:14px system-ui,sans-serif; }
  header { padding:14px 20px; position:sticky; left:0; }
  h1 { margin:0 0 4px; font-size:20px; }
  p { margin:2px 0; color:var(--muted); max-width:900px; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; margin-top:8px; }
  .legend i { display:inline-block; width:12px; height:12px; border-radius:3px; margin-right:5px; vertical-align:-1px; }
  .wrap { overflow:auto; padding-bottom:30px; }
  svg { display:block; min-width:${width}px; }
  .edge { fill:none; stroke:var(--muted); stroke-width:1.6; opacity:.55; }
  .edge.soft { stroke-dasharray:5 4; opacity:0; }
  .edge.soft.hl { opacity:1; }
  .lane { fill:var(--c); opacity:.07; }
  .lane-t { font:700 13px system-ui,sans-serif; text-transform:uppercase; letter-spacing:.06em; }
  .node rect { fill:var(--card); stroke:var(--c); stroke-width:2; }
  .node .n { font-weight:700; font-size:13.5px; fill:var(--fg); }
  .node .s { font-size:11px; fill:var(--muted); }
  .node .u { font-size:11px; fill:var(--fg); opacity:.85; }
  .dim { opacity:.12 !important; }
  .hl.edge { stroke:var(--fg); opacity:1; stroke-width:2.4; }
  .node { cursor:default; }
</style></head><body>
<header>
  <h1>Arbre des technologies</h1>
  <p>Chaque colonne est un niveau de dépendance (la gauche se recherche en premier). Trait plein : technologie requise. Trait pointillé (visible au survol) : la recherche de la technologie fait apparaître l'autre dans la fenêtre. Survolez une carte pour surligner ses prérequis et ce qu'elle ouvre.</p>
  <p>Généré par <code>node scripts/arbre-technologies.mjs</code> d'après <code>content/techs.json</code>.</p>
  <div class="legend">${legend}</div>
</header>
<div class="wrap"><svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${lanes}${edges}${nodes}</svg></div>
<script>
  const nodes = [...document.querySelectorAll('.node')], edges = [...document.querySelectorAll('.edge')];
  const rel = (id, dir, set) => { set.add(id); edges.forEach(e => { if (e.dataset[dir === 'up' ? 'to' : 'from'] === id) rel(e.dataset[dir === 'up' ? 'from' : 'to'], dir, set); }); return set; };
  nodes.forEach(n => {
    n.addEventListener('mouseenter', () => {
      const keep = new Set([...rel(n.dataset.id, 'up', new Set()), ...rel(n.dataset.id, 'down', new Set())]);
      nodes.forEach(x => x.classList.toggle('dim', !keep.has(x.dataset.id)));
      edges.forEach(e => { const on = keep.has(e.dataset.from) && keep.has(e.dataset.to); e.classList.toggle('dim', !on); e.classList.toggle('hl', on); });
    });
    n.addEventListener('mouseleave', () => document.querySelectorAll('.dim,.hl').forEach(x => x.classList.remove('dim', 'hl')));
  });
</script>
</body></html>
`;
writeFileSync('docs/arbre-technologies.html', html);
console.log(
  `${techs.length} technologies, ${cols.length} colonnes -> docs/arbre-technologies.html`,
);
