# Clair

Clair est une application responsive de gestion de tâches en français. La version publiée sur GitHub Pages fonctionne sans serveur : elle enregistre les tâches dans le stockage local du navigateur.

## Tester l’application

Pour un test rapide, ouvrez `index.html` dans un navigateur récent. Pour tester depuis un petit serveur local si votre navigateur restreint l’ouverture directe :

```powershell
python -m http.server 8000
```

Puis ouvrez [http://localhost:8000](http://localhost:8000).

## Publier sur GitHub Pages

1. Connectez-vous sur [github.com](https://github.com) et créez un dépôt public nommé, par exemple, `clair`.
2. Dans le dépôt, choisissez **Add file → Upload files**.
3. Décompressez l’archive Clair sur votre ordinateur, puis déposez les fichiers `index.html`, `styles.css` et `app.js` à la racine de la page de téléversement. Vous pouvez également ajouter `README.md`.
4. Cliquez sur **Commit changes** pour enregistrer les fichiers dans la branche `main`.
5. Ouvrez **Settings → Pages** dans le dépôt.
6. Sous **Build and deployment**, choisissez **Deploy from a branch**, sélectionnez la branche `main` et le dossier `/(root)`, puis cliquez sur **Save**.
7. Attendez la publication ; GitHub affichera l’adresse du site dans la section Pages. Elle ressemble à `https://VOTRE-NOM.github.io/clair/`.

GitHub Pages sert le site web statique, pas le serveur Python. Les tâches restent enregistrées sur l’appareil et dans le navigateur qui les a créées ; elles ne sont pas synchronisées entre appareils et peuvent être effacées avec les données du navigateur.

## API Python optionnelle

Le fichier `server.py` conserve une API REST utilisable séparément. Python 3.9 ou plus récent est requis :

```powershell
python server.py
```

L’API est alors disponible sur `http://127.0.0.1:8000` et conserve ses données dans `tasks.json`.

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/tasks` | Récupérer la liste des tâches |
| `GET` | `/api/stats` | Récupérer les totaux et la progression |
| `POST` | `/api/tasks` | Créer une tâche |
| `PATCH` | `/api/tasks/{id}` | Modifier un ou plusieurs champs |
| `DELETE` | `/api/tasks/{id}` | Supprimer une tâche |
