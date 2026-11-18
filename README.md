# Armurerie

Appli perso pour gérer ton stock de munitions, ton rechargement, tes séances de tir, tes armes et toutes les dépenses associées. Elle fonctionne sur mobile (installable sur l'écran d'accueil) et sur PC.

**Hors-ligne d'abord** : tout est enregistré sur l'appareil, puis envoyé au serveur dès qu'il y a du réseau. Au stand sans 4G, tu continues à saisir normalement ; la pastille en haut indique « Hors-ligne · 3 », puis repasse à « À jour » toute seule.

## Déployer sur Coolify

1. Mets ce dossier dans un dépôt Git (GitHub, Gitea…) ou utilise « Docker Compose » / « Dockerfile » dans Coolify.
2. Nouvelle ressource → **Application** → depuis le dépôt → Build pack **Dockerfile**.
3. **Port** exposé : `3000`.
4. **Variables d'environnement** :
   - `ADMIN_USER` : ton identifiant administrateur (ex. `moi`)
   - `ADMIN_PASSWORD` : ton mot de passe (utilisé seulement au premier démarrage pour créer ton compte ; change-le ensuite dans l'appli si tu veux)
   - `APP_SECRET` : une longue chaîne aléatoire, **obligatoire** (ex. `openssl rand -hex 32`). Si tu la changes, tout le monde devra se reconnecter.
5. **Stockage persistant** : ajoute un volume monté sur `/data` (indispensable, sinon les données sont perdues à chaque redéploiement).
6. Mets un domaine avec HTTPS (Coolify le fait automatiquement). **Le HTTPS est obligatoire** pour l'installation sur mobile et le mode hors-ligne.

## Installer sur ton téléphone

- **iPhone** : ouvre l'adresse dans Safari → bouton Partager → « Sur l'écran d'accueil ».
- **Android** : Chrome → ⋮ → « Installer l'application ».
- **PC** : Chrome/Edge → icône d'installation dans la barre d'adresse (ou utilise simplement l'onglet).

Il faut être connecté au réseau la toute première fois (connexion avec le mot de passe). Ensuite, tout marche sans réseau.

## Comment ça marche

| Action | Ce qui se met à jour tout seul |
|---|---|
| **Achat** d'un composant (poudre, amorces…) | Stock + prix moyen + dépenses |
| **Charger un lot** (depuis une recette) | Déduit poudre (charge × quantité), amorces, ogives, douilles · crée le stock de munitions rechargées |
| **Séance de tir** | Déduit les munitions · ajoute les coups au compteur de l'arme · remet les douilles récupérées en stock |
| **Entretien** | Historique de l'arme · remet à zéro le compteur « depuis le dernier entretien » · dépense si coût |
| **Corriger** (inventaire) | Ajuste un stock sans fausser l'historique |

- **Coût par coup** : calculé à partir des prix d'achat moyens (poudre + amorce + ogive, douille non comptée car réutilisée).
- **Capacité** : pour chaque recette, l'appli te dit combien de cartouches tu peux encore charger et quel composant te limite.
- **Alertes** : stock bas (seuil par composant) et entretien conseillé (tous les X coups, par arme).

## Comptes, invitations et partage

- **Toi** (administrateur) : ⚙︎ → *Codes d'invitation* → *Nouveau code*. Donne le code à la personne.
- **La personne** : sur l'écran de connexion → *J'ai un code d'invitation* → code + identifiant + mot de passe. Chaque code sert une fois et expire après 14 jours.
- **Chacun a son espace « Perso »**, invisible pour les autres (stock, armes, dépenses).
- **Espaces partagés** : bouton en haut de l'écran (« Perso ▾ ») → *Créer un espace partagé*. Dans *Gérer*, tu ajoutes des membres par leur identifiant, ou tu crées un code qui fait rejoindre directement l'espace à quelqu'un qui n'a pas encore de compte. Tous les membres voient et modifient le même stock ; chaque saisie indique qui l'a faite (« · marc »).
- **Mot de passe oublié** : ⚙︎ → *Utilisateurs* → *Réinit.* donne un mot de passe temporaire.
- Se déconnecter efface les données de l'appareil (elles restent sur le serveur) : pratique sur un appareil prêté.

## Données & sauvegardes

- Les données sont dans `/data/db.json` sur le serveur.
- Une copie est faite chaque jour dans `/data/backups/` (14 jours conservés).
- Réglages (⚙︎) → « Exporter une sauvegarde » pour télécharger un .json de l'espace affiché, et « Exporter les dépenses (CSV) » pour Excel.
- Si deux appareils modifient la même fiche hors-ligne, c'est la modification la plus récente qui l'emporte.

## Lancer en local

```bash
ADMIN_USER=moi ADMIN_PASSWORD=motdepasse APP_SECRET=$(openssl rand -hex 32) node server.js
# → http://localhost:3000
```

Aucune dépendance à installer (Node 20 ou plus).
