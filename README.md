# Clair

Clair est une application responsive de gestion de tâches disponible en français, anglais, arabe, italien, espagnol et allemand. Elle propose un thème sombre, des animations discrètes et deux modes de sauvegarde : local dans le navigateur ou synchronisé entre appareils avec un compte Clair.

## Tester l’application

Pour tester depuis un petit serveur local :

```powershell
python -m http.server 8000
```

Ouvrez ensuite [http://localhost:8000](http://localhost:8000). Sans configuration Supabase, les tâches restent enregistrées localement dans le navigateur.

## Activer les comptes et la synchronisation

GitHub Pages héberge les fichiers du site, mais ne fournit pas de base de données ni de service de comptes. La synchronisation nécessite un projet Supabase. Le navigateur utilise uniquement sa clé publique « anon »/« publishable » ; **ne mettez jamais une clé `service_role` dans ce site**.

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez le contenu de [`supabase-setup.sql`](./supabase-setup.sql). Il crée la table des tâches et applique des règles Row Level Security pour que chaque compte ne puisse lire et modifier que ses propres tâches.
3. Dans **Project Settings → API**, copiez l’URL du projet et sa clé publique `anon`/`publishable`. Remplacez les deux valeurs vides de [`supabase-config.js`](./supabase-config.js) par ces valeurs.
4. Dans **Authentication → URL Configuration**, définissez l’URL de votre site GitHub Pages comme **Site URL** et ajoutez-la aux **Redirect URLs**. Pendant le développement local, ajoutez aussi `http://127.0.0.1:8000/**`.
5. Les comptes par e-mail et mot de passe sont pris en charge par défaut. Pour Google, activez le fournisseur Google dans **Authentication → Sign In / Providers**, renseignez les identifiants OAuth créés dans Google Cloud Console, puis ajoutez l’URL de rappel affichée par Supabase aux URI de redirection autorisées du client OAuth Google.
6. Enregistrez et envoyez vos changements sur la branche publiée par GitHub Pages. Pour un dépôt configuré comme celui-ci, cela se fait généralement avec **Commit** puis **Sync Changes/Push** dans VS Code. Après le push, GitHub Pages déploie les nouveaux fichiers ; l’application peut alors se connecter à Supabase.

Les clés publiques de Supabase ne sont pas des mots de passe : la protection des données repose sur les politiques RLS du script SQL. Ne désactivez pas ces politiques. Les nouvelles tâches sont synchronisées en ligne lorsque vous êtes connecté. Si vous aviez déjà des tâches locales, connectez-vous puis choisissez **Importer les tâches de cet appareil** depuis le panneau du compte pour les ajouter au compte. Elles ne sont pas importées automatiquement.

La connexion Google dépend de la configuration OAuth Google/Supabase, et la confirmation d’adresse e-mail peut être demandée selon les réglages d’authentification du projet. L’application fonctionne toujours sans Supabase, mais dans ce cas ses données ne sont disponibles que dans le navigateur courant.

## API Python optionnelle

Le fichier `server.py` expose séparément une API REST locale. Python 3.9 ou plus récent est requis :

```powershell
python server.py
```

L’API est alors disponible sur `http://127.0.0.1:8000` et conserve ses données dans `tasks.json`. Cette API locale n’est pas le service de synchronisation de la version GitHub Pages.

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/tasks` | Récupérer la liste des tâches |
| `GET` | `/api/stats` | Récupérer les totaux et la progression |
| `POST` | `/api/tasks` | Créer une tâche |
| `PATCH` | `/api/tasks/{id}` | Modifier un ou plusieurs champs |
| `DELETE` | `/api/tasks/{id}` | Supprimer une tâche |
