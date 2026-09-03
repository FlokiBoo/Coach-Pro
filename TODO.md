# TODO

Tâches identifiées mais pas encore traitées, à reprendre en session.

## Prochaine étape
- [ ] **Améliorer le goniomètre** (mesure d'angle par photo, `app/movements` ou équivalent) — priorité annoncée le 2026-09-03.

## Backlog
- [ ] Remplacer les icônes emoji par une vraie librairie SVG — tab bar athlète en priorité, puis le reste de l'app (chantier transverse, plusieurs fichiers).
- [ ] Repli automatique de la card d'un exercice une fois validé, en séance (mode focus) — "peut-être un plus", pas urgent.
- [ ] Pop-up "bonne anniversaire" le jour J, basé sur `athletes.birth_date` (déjà collecté à l'inscription).
- [ ] Champ "sexe" : proposer plus d'options que H/F ; si l'athlète ne se reconnaît pas dans ces deux, lui demander explicitement quel jeu de standards (badges force/cardio, actuellement indexés H/F dans `lib/badges.js`/`lib/cardioBadges.js`) utiliser pour ses résultats. Décision de modèle de données à prendre avant de commencer.
- [ ] Avant de connecter l'assistant IA (`app/api/ai/chat`) ou le générateur de repas (`lib/mealPlanner.js`) à un vrai backend IA : ajouter un rate limiting (remonté en revue sécurité pré-lancement, endpoint à coût si non protégé).
- [ ] 3 captures d'écran promises par l'utilisateur pour des améliorations UI (mentionné le 2026-08-29) — à réclamer si pas encore reçues.

## Mis de côté (repris si besoin)
- Vue chronologique : gérer explicitement les collisions (avertir le coach si deux programmes actifs tombent le même jour) — pour l'instant les deux séances s'affichent simplement, sans avertissement, décision volontaire du 2026-09-03.
