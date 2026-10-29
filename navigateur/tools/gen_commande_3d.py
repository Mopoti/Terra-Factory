"""Génère docs/objets-sans-design.md (la commande de modèles 3D) d'après le jeu en marche.

Lancer depuis `navigateur/` : python3 tools/gen_commande_3d.py
Il faut d'abord l'audit des objets : un test vitest temporaire écrit /tmp/audit.json (voir passation, tour 279) ; ce script
n'en lit que les formes de dépôt au sol. Les listes « provisoire » et « pas dans le jeu » sont écrites ici à la main.
"""
import json
fr=json.load(open('src/i18n/fr.json'))
name=lambda i: fr.get('item.'+i,i)
mach={m['id']:m for m in json.load(open('content/machines.json'))['machines']}
L=[];A=L.append
A("# Commande de modèles 3D (état du tour 280)\n")
A("Liste faite sur le jeu en marche (`content/items.json`, `content/machines.json`, `dropModels.ts`, `models.ts`). **Règle : l'icône d'inventaire et le modèle au sol sont le même modèle** (l'icône est une vue isométrique du modèle au sol ; pour une machine, de sa miniature). Un seul modèle à fournir par objet pour les trois usages (sol, inventaire, posé quand c'est une machine / construction / véhicule). Les fichiers vont dans `blender/` → `export/` → `public/models/terra`. Les faces magenta des formes d'objets prennent la couleur de l'objet.\n")
A("## 1. Dans le jeu avec un modèle provisoire ou dessiné par le code (à remplacer)\n")
A("### 1a. Machines posées (modèle d'une autre machine réutilisé)\n")
A("| Objet | Modèle provisoire | Emprise (cases de 50 cm) | Ce qu'il faut |\n| --- | --- | --- | --- |")
rows=[
('pole_hv','poteau_electrique','mât de 6 m, 3 bras, grands isolateurs'),('pole_uhv','poteau_electrique','pylône de 10 m, 3 bras larges'),('lamp','poteau_electrique','mât de 3 m, lampe qui s\'allume la nuit (pièce `lueur`)'),
('wind_turbine','poteau_electrique','mât de 6 m, rotor à trois pales qui tourne (pièce animée)'),('transformer','accumulateur_t3','cuve, 3 isolateurs, ailettes'),('breaker','accumulateur_t3','coffret à levier ; fermé / ouvert si possible'),
('solar_panel','accumulateur_t3','panneau incliné bleu sur pied'),('accumulator_basic','accumulateur_t3','plus petit et plus simple que l\'accumulateur lithium T4'),('charger','accumulateur_t3','borne avec câble et prise pour véhicule, voyant de charge'),
('assembler_advanced','assembleur_t2','variante visible de l\'assembleur T2'),('fabricator','assembleur_t2','assembleur futuriste (T5), 4×4'),
('air_compressor','centrifugeuse_t4','cuve horizontale et compresseur'),('electrolyzer','centrifugeuse_t4','cuves et électrodes, prise d\'eau'),('air_purifier','centrifugeuse_t4','tour à filtres, aérations'),
('fuel_cell','generateur_combustible','empilement de cellules, réservoir de deutérium'),('drill_plasma','foreuse_eco_t3','grande foreuse 6×6, tête à plasma'),('arm_industrial','bras_t3','bras robotique grand format et rapide'),
('quantum_chest','coffre_fer','coffre violet lumineux, motif quantique'),('turret_rail','tourelle_plasma','canon à rails long, rails visibles')]
for k,mod,rem in rows:
    m=mach[k]; A(f"| {name(m['item'])} (`{m['item']}`) | `{mod}` | {m['w']}×{m['d']}, haut. {m['height']} m | {rem} |")
A("")
A("### 1b. Barrières et portails (dessinés par le code : poteaux et lisses, aucun modèle)\n")
A("| Objet | Emprise | Ce qu'il faut |\n| --- | --- | --- |")
for k,rem in [('fence_wood','clôture à lattes, 1,5 m ; 3 états d\'usure'),('barrier_concrete','mur bas en béton, 1,5 m ; fissures selon l\'usure'),('barrier_reinforced','béton armé avec armatures apparentes ; usure'),('gate_wood','portail à deux vantaux ou coulissant, 3 m ; fermé / ouvert'),('gate_concrete','portail béton, 3 m ; fermé / ouvert'),('gate_reinforced','portail blindé à moteur visible, 3 m ; ouvre seul à l\'approche'),('hologram_projector','deux émetteurs et un voile de lumière, 1,5 m'),('hologram_gate','émetteurs et voile de lumière, 3 m ; ouvert / fermé')]:
    m=mach[k]; A(f"| {name(m['item'])} (`{m['item']}`) | {m['w']}×{m['d']}, haut. {m['height']} m | {rem} |")
A("Usure : les machines abîmées sont noircies par le code (suie par taches, fumée sous 50 %, étincelles sous 25 %) ; des modèles à états abîmés (3 niveaux) amélioreraient le rendu.\n")
A("### 1c. Véhicules et matériel roulant (modèle d'un autre véhicule réutilisé)\n")
A("| Objet | Modèle provisoire | Ce qu'il faut |\n| --- | --- | --- |")
A("| Quad électrique (`vehicle_quad_electric`) | `quad` | variante électrique : batterie visible, pas d'échappement |")
A("| Locomotive électrique (`train_locomotive_electric`) | `locomotive_vapeur` | loco électrique à batterie, sans cheminée |")
A("| Wagon plateforme (`train_wagon_flat`) | `wagon_fret` | plateau ouvert avec ridelles basses |")
A("| Mur blindé, porte blindée | modèles de l'aluminium | variante blindée (plaques rivetées) |")
A("")
A("### 1d. Objets (sac et sol) à forme partagée ou provisoire\n")
A("| Objet | Forme actuelle | Il faudrait |\n| --- | --- | --- |")
rows2=json.load(open('/tmp/claude-0/-home-user-Terra-Factory/321d8bf2-7c57-5c8c-af02-ddbd7a8bba29/scratchpad/audit.json'))
by={r['id']:r for r in rows2}
need={'aluminium_rod':'tige (aluminium, plus claire)','chassis_simple':'petit châssis soudé','chassis_steel':'châssis renforcé','chassis_alu':'châssis léger','chassis_composite':'châssis composite noir','glass':'vitre (plaque transparente)','armored_glass':'vitre blindée (épaisse, croisillons)','graphite':'bloc de graphite noir brillant','lithium_salt':'tas de sel blanc-rosé','carbon_fiber':'rouleau de fibre noire tressée','kit_circuit':'petite carte avec composants','repair_kit':'boîte à outils rouge-orange (clé, tournevis)','battery_portable':'pile de poche ; prévoir la zone où la jauge s\'affiche sous l\'icône','circuit_advanced':'carte plus dense, dorée','microcontroller':'puce carrée à broches','solar_cell':'cellule bleue quadrillée','graphite_filter':'filtre en nid d\'abeille','battery_lithium':'pile cylindrique / bloc batterie','fusion_capsule':'capsule sphérique brillante','supra_magnet':'aimant en U / tore supraconducteur','quantum_crystal':'cristal violet facetté','deuterium':'bonbonne de gaz (étiquette D)','tritium':'bonbonne de gaz (étiquette T)','liquid_nitrogen':'bonbonne cryogénique givrée'}
for k,v in need.items():
    r=by.get(k)
    A(f"| {name(k)} (`{k}`) | forme `{r['shape'] if r else 'conteneur'}` | {v} |")
A("")
A("### 1e. Formes partagées sans être provisoires (à distinguer un jour)\n")
A("| Forme | Objets | Proposition |\n| --- | --- | --- |")
for r in ["| lingot | fer, cuivre, zinc, fonte, acier, aluminium, zamak | différencier l'aluminium et le zamak |","| plaque / engrenage / bobine | moules de plaque, d'engrenage, de fil | un vrai **moule** (cadre creux) pour chacun |","| bobine | fil de cuivre, câble isolé | gaine visible sur le câble isolé |","| puce | puce de silicium, isolant plastique | l'isolant n'est pas une puce |","| science | paquets T1 à T5 et de combat (6) | **un visuel par palier** (couleur et symbole) |","| baril | vide, d'eau, de pétrole, pétrole brut | le contenu ou l'étiquette se voit |","| conteneur | uranium enrichi, appauvri, barre d'uranium, déchets nucléaires | barre (tige jaune) et fût de déchets distincts |"]: A(r)
A("")
A("### 1f. Équipement\n")
for r in ["- **Veste** (`jacket`) : tout (modèle d'objet et modèle porté ; garde la forme de caisse).","- **Armures composite (3) et nano (5)** (casque, plastron, jambières, bottes) : modèles d'objet + portés ; elles prennent les formes des armures 2 et 4.","- **Exosquelette** (forme du pantalon) et **propulseur dorsal** (`jetpack`, forme du sac à dos) : modèles propres.","- **Modèles portés de tout l'équipement** (sac à dos, capuche, pantalon, bottes, gants, armures 1 à 5, veste) : sur le personnage ce sont encore des boîtes colorées (`refreshWorn` dans `gameView.ts`)."]: A(r)
A("")
A("### 1g. Rails\n")
A("Le droit cardinal et la rampe ont leur modèle ; la **courbe 45° (rayon 8,75 m)**, le **droit en diagonale (3,54 m)** et le **croisement en diagonale** sont dessinés par une forme simple. À modéliser : rail courbe, rail diagonal, éventuellement aiguillage visuel.\n")
A("## 2. Résumé\n")
A("- **Priorité (vu en jeu tout de suite)** : modèles portés de l'équipement, veste, paquets de science par palier, moules, nouveaux rails (courbe, diagonale), barrières et portails.")
A("- **Tout le reste du contenu prévu est maintenant dans le jeu** avec un modèle provisoire (sections 1a à 1d) : il n'y a plus d'objet « prévu sans design » hors ces listes.")
open('docs/objets-sans-design.md','w').write('\n'.join(L)+'\n')
print(len(L),'lignes')
