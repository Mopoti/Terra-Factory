# Équilibrage (premier passage, à tester en jeu)

Où régler : `content/*.json` (vitesses, coûts, carburant, pollution), `src/core/game/threat.ts` (constantes en tête de fichier : ennemis, pollution), `src/core/game/seasons.ts` (saisons), `src/render/interaction.ts` (`BARE_HANDS_FACTOR`), `src/core/data/machines.ts` (tourelle).

## Principes retenus

- **Départ** : à mains nues tout est lent (×3) ; l'outil en pierre (bois + pierre) double la vitesse, l'outil en fer (lingots + bois) la triple et demi et donne 2 unités par coup. Les coûts ont été **doublés** au Tour 66 pour que ces outils aient un sens.
- **Foreuse** : 0,5 minerai/s (brûleur, `mineSeconds` 2) et 0,75/s (électrique, 1,33) — avant : 1 et 1,5. Un four (1 lingot / 3 s) suffit pour environ 1,5 foreuse brûleur.
- **Carburant** : 1 charbon = 100 s de machine, 1 bois = 20 s. Un buggy consomme 1 charbon pour ~50 s de route (≈ 585 m à 11,7 m/s).
- **Électricité** : générateur 300 kW (brûle 1 s de combustible par seconde à pleine charge), turbine 200 kW à pleine pression (consomme 20 vapeur/s ; chaudière 60 vapeur/s : 1 chaudière ≈ 3 turbines).
- **Pollution** : foreuse 0,6/s, four 0,5/s, générateur 1/s, chaudière 2/s ; assembleur 0,2, laboratoire 0,1, foreuse électrique 0,3 (sol). Les arbres absorbent, **moins en automne (×0,7) et en hiver (×0,35)**, plus en été (×1,2) : en hiver la pollution s'attarde et les nids réagissent plus.
- **Ennemis** : 25 PV ; pistolet 10 dégâts (3 balles), tourelle 9 dégâts toutes les 0,6 s (portée 22 m, ~15 dégâts/s) ; un ennemi fait 6 dégâts/s à une machine (120 PV) et 10 au joueur toutes les 1,2 s (100 PV). Un chargeur = 12 balles (2 × 2 lingots de fer = 4). Les tourelles consomment des chargeurs (fabriqués ou amenés par tapis / bras).
- **Tourelle** : 16 lingots de fer + 6 de cuivre, technologie « Défense » (30 fer, 10 cuivre, après la logistique).

## À régler avec le PO après tests

- Rythme d'apparition des ennemis (`SPAWN_COST` 20, 12 en agressif), nombre maximal (25), vitesse (3,2 m/s).
- Durée d'une saison (360 s) ; est-ce que l'hiver doit aussi augmenter la consommation de combustible ?
- Coûts des véhicules, des tourelles et des machines à l'étage ; vitesse du buggy.
- Les valeurs de ce document sont celles du code au moment de l'écriture : le code fait foi.
