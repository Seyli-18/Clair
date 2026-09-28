# Clair Cards

Clair Cards est une application de collection de cartes de personnages d’anime, disponible en français, anglais, arabe, italien, espagnol et allemand. Elle nécessite un compte pour créer un catalogue, ouvrir des paquets et synchroniser sa collection avec Supabase.

## Paquets et collection

- Chaque compte peut ouvrir **deux paquets quotidiens**, contenant **cinq cartes chacun**. Le quota se renouvelle à minuit UTC.
- Un compte peut ouvrir **un paquet de huit cartes consacré à un anime choisi toutes les 72 heures**.
- Le serveur Supabase vérifie les quotas et sélectionne les cartes. Chaque carte obtenue est enregistrée dans la collection du compte ; les doublons sont possibles.
- Les chances de tirage dépendent de la rareté : commune, rare, épique ou légendaire.
- Le catalogue d’animes et de personnages est administré depuis l’espace Owner. Les paquets quotidiens piochent dans tous les personnages actifs ; le paquet spécial pioche uniquement dans l’anime sélectionné.
- L’ouverture de paquets et la sauvegarde de cartes nécessitent une session connectée. Aucune collection n’est créée hors ligne.
- Les niveaux de rareté définissent leur nom, leur couleur et leur poids de tirage. Le poids règle les probabilités relatives : un poids plus élevé augmente la chance d’apparition, sans garantir un résultat particulier.
- Les cartes enregistrent le nom du personnage, son anime, le mangaka, une note, une image et un niveau de rareté. L’Owner peut choisir un lien HTTPS ou téléverser une image PNG, JPEG, WebP, GIF ou AVIF de 5 Mo maximum. Les images téléversées sont publiques pour être affichées sur les cartes, mais seul l’Owner peut en ajouter ou modifier les fichiers. N’ajoutez que des images que vous avez le droit d’utiliser.

## Configurer Supabase

Le site statique peut être publié avec GitHub Pages, mais les comptes et la collection sont enregistrés dans votre projet Supabase.

1. Dans le tableau de bord Supabase de votre projet, ouvrez **SQL Editor**.
2. Copiez tout le contenu de [`supabase-setup.sql`](./supabase-setup.sql), collez-le dans une requête SQL et cliquez sur **Run**. Attendez le message **Success**. Le script crée les tables, les règles RLS, le stockage d’images, les raretés initiales et les fonctions serveur qui appliquent les quotas et vérifient l’accès Owner. Il peut être réexécuté. Les anciennes tables éventuellement présentes dans le projet ne sont ni supprimées ni utilisées par cette version de Clair Cards.
3. Dans **Project Settings → API**, vérifiez les valeurs déjà configurées dans [`supabase-config.js`](./supabase-config.js) : l’URL du projet et la clé publique `anon`/`publishable`. Ne mettez jamais une clé `service_role` dans le code du site.
4. Dans **Authentication → URL Configuration**, réglez la **Site URL** sur l’adresse publiée du site et ajoutez cette adresse à **Redirect URLs**. Pour le serveur local, ajoutez aussi `http://127.0.0.1:8000/**`.
5. Pour l’e-mail et le mot de passe, activez le fournisseur **Email** sous **Authentication → Sign In / Providers**. Le projet peut demander une confirmation de l’adresse e-mail selon ses réglages.
6. Pour Google, créez les identifiants OAuth Google, activez Google dans **Authentication → Sign In / Providers** et copiez l’URL de rappel donnée par Supabase dans les URI de redirection autorisées de l’application OAuth Google.
7. Pour Discord, créez une application dans le [Discord Developer Portal](https://discord.com/developers/applications), ajoutez l’URL de rappel affichée par Supabase dans **OAuth2 → Redirects**, puis copiez l’identifiant et le secret OAuth de Discord dans le fournisseur **Discord** des réglages d’authentification Supabase.
8. Enregistrez et poussez les changements du site sur la branche publiée par GitHub Pages. Après le déploiement, connectez-vous avec `ilyessbia4@gmail.com` et ajoutez des sections d’anime, des cartes et des raretés depuis **Espace Owner**.

L’adresse `ilyessbia4@gmail.com` est ajoutée par le script à la liste Owner. L’accès à l’espace Owner demande une session dont l’adresse est confirmée par Supabase ; les politiques RLS réappliquent la vérification pour chaque création et modification. L’adresse de liste n’est pas modifiable depuis le site.

Les intégrations OAuth Google et Discord doivent être activées dans Supabase et leurs URL de rappel doivent correspondre exactement. Le code du site ne peut pas activer ces fournisseurs à votre place.

Après une ouverture de paquet, une animation apparaît, puis les cartes sont révélées une à une. Une section d’anime, une carte ou une rareté désactivée est exclue des futurs tirages ; les cartes déjà collectionnées restent conservées. Les anciennes lignes de la table `card_catalog` personnelle, si cette première table a été créée lors des essais précédents, restent intactes et ne sont plus utilisées par les nouveaux paquets.

## Lancer localement

```powershell
python -m http.server 8000
```

Ouvrez ensuite [http://127.0.0.1:8000](http://127.0.0.1:8000). Si Supabase n’est pas configuré, le site affiche l’écran de connexion, mais ne crée pas de cartes locales ni de compte hors ligne.
