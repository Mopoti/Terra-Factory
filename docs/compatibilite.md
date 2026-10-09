# Compatibilité des navigateurs

Le jeu utilise WebGL 2 (three.js), les modules ES, `localStorage`, la Web Audio API, le verrouillage du pointeur, l'API Gamepad et WebRTC (PeerJS) pour le multijoueur. Aucune API réservée à un navigateur.

| Navigateur | Statut |
|---|---|
| Chrome, Edge, Opera, Brave (moteur Chromium) | Testés en continu avec Chromium (captures et scripts de test) : fonctionnent. |
| Firefox | Non testé ici ; WebGL 2, WebRTC, verrouillage du pointeur et Gamepad sont pris en charge. |
| Safari (macOS, iOS) | **Non testé** (pas de WebKit dans l'environnement). Attendu OK à partir de Safari 15 (WebGL 2) ; le son démarre au premier clic ; l'API Gamepad y est plus limitée. |

Le code est compilé pour ES2020 (Safari 14 et plus) : `vite.config.ts`, `build.target`.

## Points d'attention
- **Brave** : les boucliers peuvent brouiller les lectures de canvas (les couleurs des modèles du Factory Kit lues dans leur palette peuvent varier de 1 sur 255, invisible) et bloquer WebRTC selon le réglage « fuite d'IP » : le multijoueur peut alors demander de désactiver cette option.
- **Safari** : le mode privé limite le stockage local ; le verrouillage du pointeur existe mais certaines combinaisons de touches (Échap) sont gérées par le navigateur.
- **Mémoire graphique** : en cas de saturation, le navigateur peut retirer l'affichage 3D (écran blanc) ; le jeu l'affiche désormais et reprend seul (Tour 153).
