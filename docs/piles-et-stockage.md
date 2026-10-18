# Taille des piles et stockage

**Appliqué (18 octobre 2026) à l'essai** : les propositions 1 et 2 ci-dessous sont en place (piles par objet via `stack` dans `content/items.json`, `fuelMax` / `stockMax` dans `content/machines.json`, `ingredientCap = max(5, besoin × 2)`). Les valeurs se règlent dans ces fichiers. Les anciennes sauvegardes gardent leur contenu : les piles se redécoupent à l'ouverture du sac (il peut dépasser 30 cases, accepté) et une machine qui a plus de combustible que sa nouvelle limite le garde, sans en recevoir plus.

---

## Propositions d'origine

Constat (17 octobre 2026) : **100 partout, pour tout**. Le joueur n'a presque jamais plus d'une pile de chaque objet, et
une machine garde une réserve énorme.

## Valeurs actuelles

| Où | Valeur | Conséquence |
|---|---|---|
| Sac du joueur | 30 cases, **pile de 100**, 50 kg, 60 L | Les objets lourds sont limités par le poids avant la pile (100 pierres = 120 kg) ; seuls les objets légers (puces, fils, fibre) atteignent 100. Résultat : le sac contient peu de piles différentes. |
| Combustible d'une machine (`stockMax`) | **100** (foreuse, four, estampeuse, concasseur) | 1 houille = 9 MJ. Four / foreuse (90 kW) : 100 s par houille, soit **2 h 47 de marche** pour une réserve pleine. Estampeuse / concasseur (60 kW) : **4 h 10**. |
| Entrées d'une machine (`ingredientCap`) | `max(10, besoin × 4)` | 4 fournées d'avance : raisonnable pour un assembleur, beaucoup pour un four. |
| Sortie d'une machine (`stockMax`) | **100** | La machine s'arrête seulement quand 100 produits attendent : un tapis bouché ne se remarque que très tard. |
| Coffre | pile de 100 (`CHEST_STACK`) | Cohérent avec le sac aujourd'hui. |
| Bras (10), laboratoire, tourelles, chaudière (20) | déjà petits | À garder. |

## Proposition 1 : une taille de pile par objet

Un champ `stack` par objet dans `content/items.json` (défaut 50), au lieu de `bag.stackMax = 100` pour tous. Le sac garde
30 cases : le joueur porte **plus de piles différentes**, chacune plus petite, ce qui oblige à choisir et à trier.

| Famille | Exemples | Pile proposée |
|---|---|---|
| Vrac lourd | pierre, bois, béton | 20 |
| Minerais, sable, houille | malachite, hématite, houille | 50 |
| Lingots et plaques | lingots, plaques | 50 |
| Pièces | engrenages, fils, isolants | 100 (légers) |
| Électronique, science | puces, paquets de science | 100 |
| Barils, conteneurs | barils, déchets nucléaires | 10 |
| Machines | four, foreuse, assembleur… | 10 (tapis : 50) |
| Pièces de construction | murs, dalles… | 50 |
| Équipement, outils | sac à dos, armure, pioche | 1 |

Effet : un sac plein de houille tient 12,5 kg par pile au lieu de 25 kg, et trois piles de minerai différentes ne
mangent plus 3 × 100 unités de poids. Le poids / volume restent les vrais plafonds.

## Proposition 2 : combustible et réserves des machines

On sépare **trois tampons** par machine, chacun avec sa propre taille :

| Tampon | Aujourd'hui | Proposition | Durée / effet |
|---|---|---|---|
| Combustible foreuse et four (90 kW) | 100 | **10** | 10 houilles = 16 min 40 de marche |
| Combustible estampeuse et concasseur (60 kW) | 100 | **10** | 25 min |
| Combustible bras (20 kW), chaudière, générateur | 10 / 20 / — | inchangé | |
| Entrées (`ingredientCap`) | `max(10, besoin×4)` | `max(5, besoin×2)` | 2 fournées d'avance |
| Sortie | 100 | **20** | la machine s'arrête plus tôt si la sortie bouche : le problème se voit vite |

Variante « à cran » : la taille du tampon grandit avec la machine (T1 : 10 houilles, T2 : 20, T3 : 40), pour récompenser
l'amélioration sans revenir à 100.

## Proposition 3 : le joueur porte plusieurs piles

- Avec les piles par objet (proposition 1), le sac de 30 cases se remplit en **piles variées** au lieu de quelques piles
  de 100 : on peut porter, par exemple, 1 pile de houille, 1 de lingots, 1 de plaques, 2 de pièces, 3 de machines.
- Le **sac à dos** donne déjà des cases en plus : on peut en faire la vraie progression de capacité (+10 cases
  aujourd'hui) plutôt que de gonfler les piles.
- Option : **cases rapides** (barre d'objets) qui comptent pour la même réserve, déjà en place.

## À décider ensemble

1. Les tailles par famille ci-dessus vous conviennent-elles (surtout minerais 50, pierre / bois 20, machines 10) ?
2. Combustible : 10 houilles (≈ 17 min) pour four et foreuse, ou plus (20 ≈ 33 min) pour laisser le temps d'aller
   ailleurs sur la carte ? Un tampon plus grand en palier supérieur ?
3. Sortie de machine à 20 : vous préférez une valeur plus généreuse (50) ?
4. Migration des sauvegardes : les piles existantes de plus de la nouvelle taille se découpent en plusieurs cases (le
   sac peut alors dépasser ses 30 cases : accepté, ou on garde l'ancien tampon pour les sauvegardes déjà créées ?).

Aucun fichier de contenu ni de code n'a été modifié pour ces propositions ; une fois les valeurs choisies, la mise en
œuvre touche `content/items.json` (`stack`), `content/machines.json` (tampons), `src/core/game/inventory.ts` et
`src/core/factory/factory.ts` (`ingredientCap`, `CHEST_STACK`), avec des tests.
