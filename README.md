# Clair Cards

Clair Cards est une application de collection de cartes de personnages d’anime, disponible en français, anglais, arabe, italien, espagnol et allemand. Elle nécessite un compte pour créer un catalogue, ouvrir des paquets et synchroniser sa collection avec Supabase.

## Paquets et collection

- Chaque compte peut ouvrir **deux paquets quotidiens**, contenant **cinq cartes chacun**. Le quota se renouvelle à minuit UTC.
- Un compte peut ouvrir **un paquet de huit cartes consacré à un anime choisi toutes les 72 heures**.
- Le serveur Supabase vérifie les quotas et sélectionne les cartes. Chaque carte obtenue est enregistrée dans la collection du compte ; les doublons sont possibles.
- Les chances de tirage dépendent de la rareté : commune, rare, épique ou légendaire.
- Chaque compte gère son propre catalogue. Les paquets quotidiens piochent dans tous les personnages de son catalogue ; le paquet spécial pioche uniquement dans l’anime sélectionné.
- L’ouverture de paquets et la sauvegarde de cartes nécessitent une session connectée. Aucune collection n’est créée hors ligne.
- Le catalogue accepte des noms de personnages et un lien d’illustration HTTPS facultatif. N’ajoutez que des images que vous avez le droit d’utiliser. Les illustrations liées sont hébergées par leurs sources d’origine ; elles ne sont pas copiées dans Supabase.

## Configurer Supabase

Le site statique peut être publié avec GitHub Pages, mais les comptes et la collection sont enregistrés dans votre projet Supabase.

1. Dans le tableau de bord Supabase de votre projet, ouvrez **SQL Editor**.
2. Copiez tout le contenu de [`supabase-setup.sql`](./supabase-setup.sql), collez-le dans une requête SQL et cliquez sur **Run**. Attendez le message **Success**. Le script crée les tables privées, les règles RLS et la fonction serveur qui applique les quotas. Il peut être réexécuté. Les anciennes tables d’organisation éventuellement présentes dans le projet ne sont ni supprimées ni utilisées par cette version de Clair Cards.
3. Dans **Project Settings → API**, vérifiez les valeurs déjà configurées dans [`supabase-config.js`](./supabase-config.js) : l’URL du projet et la clé publique `anon`/`publishable`. Ne mettez jamais une clé `service_role` dans le code du site.
4. Dans **Authentication → URL Configuration**, réglez la **Site URL** sur l’adresse publiée du site et ajoutez cette adresse à **Redirect URLs**. Pour le serveur local, ajoutez aussi `http://127.0.0.1:8000/**`.
5. Pour l’e-mail et le mot de passe, activez le fournisseur **Email** sous **Authentication → Sign In / Providers**. Le projet peut demander une confirmation de l’adresse e-mail selon ses réglages.
6. Pour Google, créez les identifiants OAuth Google, activez Google dans **Authentication → Sign In / Providers** et copiez l’URL de rappel donnée par Supabase dans les URI de redirection autorisées de l’application OAuth Google.
7. Pour Discord, créez une application dans le [Discord Developer Portal](https://discord.com/developers/applications), ajoutez l’URL de rappel affichée par Supabase dans **OAuth2 → Redirects**, puis copiez l’identifiant et le secret OAuth de Discord dans le fournisseur **Discord** des réglages d’authentification Supabase.
8. Enregistrez et poussez les changements du site sur la branche publiée par GitHub Pages. Après le déploiement, inscrivez-vous, confirmez votre adresse e-mail si demandé, ajoutez des personnages dans **Mon catalogue**, puis ouvrez un paquet.

Les intégrations OAuth Google et Discord doivent être activées dans Supabase et leurs URL de rappel doivent correspondre exactement. Le code du site ne peut pas activer ces fournisseurs à votre place.

## Lancer localement

```powershell
python -m http.server 8000
```

Ouvrez ensuite [http://127.0.0.1:8000](http://127.0.0.1:8000). Si Supabase n’est pas configuré, le site affiche l’écran de connexion, mais ne crée pas de cartes locales ni de compte hors ligne.
