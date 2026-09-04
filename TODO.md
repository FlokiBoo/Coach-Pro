# TODO

Tâches identifiées mais pas encore traitées, à reprendre en session.

## Prochaine étape
- [ ] **Lancer l'agent `persona-grincheux` pour tester l'app** (demandé le 2026-09-04, à faire à la connexion du 2026-09-05) — arbitre final de tout ce qui est visible côté client, à passer sur les écrans/parcours touchés récemment (onglet Séance restructuré, groupe/leader, etc.).
- [ ] **Améliorer le goniomètre** (mesure d'angle par photo, `app/movements` ou équivalent) — priorité annoncée le 2026-09-03.

## Backlog
- [ ] Réduire la liste des PR dans l'onglet Records (`app/components/TrackedMovementsBlock.js`) — quoi exactement à préciser avec l'utilisateur (moins de mouvements par défaut ? suppression de mouvements précis ? moins de catégories ?).
- [ ] Repli automatique de la card d'un exercice une fois validé, en séance (mode focus) — "peut-être un plus", pas urgent.
- [ ] Pop-up "bonne anniversaire" le jour J, basé sur `athletes.birth_date` (déjà collecté à l'inscription).
- [ ] Champ "sexe" : proposer plus d'options que H/F ; si l'athlète ne se reconnaît pas dans ces deux, lui demander explicitement quel jeu de standards (badges force/cardio, actuellement indexés H/F dans `lib/badges.js`/`lib/cardioBadges.js`) utiliser pour ses résultats. Décision de modèle de données à prendre avant de commencer.
- [ ] Avant de connecter l'assistant IA (`app/api/ai/chat`) ou le générateur de repas (`lib/mealPlanner.js`) à un vrai backend IA : ajouter un rate limiting (remonté en revue sécurité pré-lancement, endpoint à coût si non protégé).
