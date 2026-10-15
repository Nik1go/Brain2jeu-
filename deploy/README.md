# Brain2jeu sur brain2jeu.leofinance.fr

Cette procédure vise un VPS **Debian ou Ubuntu avec Nginx installé directement sur le système**. Si Nginx tourne dans Docker ou est géré par un panneau, adapter les chemins et le rechargement avant l'installation.

L'application est statique : compilation sur le PC, puis Nginx sert les fichiers. Aucun processus Node, PM2 ou serveur Vite n'est nécessaire sur le VPS. Le site principal garde son propre bloc Nginx.

## 1. DNS du sous-domaine

Dans la zone DNS de `leofinance.fr`, ajouter :

| Type | Nom | Valeur |
| --- | --- | --- |
| A | `brain2jeu` | IPv4 publique du VPS qui héberge Nginx |

Ne créer un enregistrement AAAA que si ce VPS sert aussi le site sur cette IPv6. Vérifier que le sous-domaine résout vers le VPS avant de demander son certificat.

Depuis PowerShell :

```powershell
Resolve-DnsName brain2jeu.leofinance.fr
```

## 2. Préparer et envoyer les fichiers depuis le PC

Depuis le dossier du projet :

```powershell
npm run release:vps
scp .\artifacts\brain2jeu-vps.tar.gz .\deploy\brain2jeu.nginx.conf .\deploy\install-release.sh utilisateur@IP_DU_VPS:/tmp/
ssh utilisateur@IP_DU_VPS
```

Remplacer `utilisateur@IP_DU_VPS` par la connexion SSH habituelle. Si le port est différent de 22, utiliser `scp -P PORT` et `ssh -p PORT`. Utiliser l'authentification SSH existante ; aucun secret ne doit être ajouté au dépôt.

L'archive ne contient que le build public, sans les sources, `.git` ou `node_modules`.

## 3. Installer le build sur le VPS

Dans la session SSH :

```bash
sudo bash /tmp/install-release.sh /tmp/brain2jeu-vps.tar.gz
```

Le script crée une version dans `/var/www/brain2jeu/releases/`, vérifie son contenu puis bascule le lien `/var/www/brain2jeu/current`. Les versions précédentes restent disponibles. Il ne modifie pas Nginx.

## 4. Ajouter le nouveau site Nginx, une seule fois

Vérifier d'abord la configuration actuelle :

```bash
sudo nginx -t
ls -l /etc/nginx/sites-enabled/
```

Pour une première installation, lorsque `brain2jeu.conf` n'existe pas encore dans `sites-available` ou `sites-enabled` :

```bash
sudo install -m 644 /tmp/brain2jeu.nginx.conf /etc/nginx/sites-available/brain2jeu.conf
sudo ln -s /etc/nginx/sites-available/brain2jeu.conf /etc/nginx/sites-enabled/brain2jeu.conf
sudo nginx -t && sudo systemctl reload nginx
```

La configuration cible seulement `brain2jeu.leofinance.fr`. Elle ne doit pas remplacer le fichier de `leofinance.fr`. Si le VPS n'a pas IPv6 activé, retirer la ligne `listen [::]:80;`. Sur une distribution qui utilise `conf.d` à la place de `sites-enabled`, installer le bloc à cet emplacement selon sa configuration actuelle.

Vérifier le nouveau bloc avant de continuer :

```bash
curl -I -H 'Host: brain2jeu.leofinance.fr' http://127.0.0.1/
curl -I http://brain2jeu.leofinance.fr/
```

Le port 80 doit être accessible depuis Internet pour la validation HTTP de Let's Encrypt. Le port 443 doit être accessible pour servir HTTPS. Conserver les règles d'accès SSH existantes.

## 5. Activer HTTPS

Si Certbot avec son plugin Nginx est déjà installé sur ce VPS :

```bash
sudo certbot --nginx -d brain2jeu.leofinance.fr --cert-name brain2jeu.leofinance.fr --redirect
sudo nginx -t
sudo certbot renew --cert-name brain2jeu.leofinance.fr --dry-run
```

Cette commande crée un certificat pour ce seul sous-domaine et ajoute la redirection HTTPS. Si Certbot est absent, choisir la méthode d'installation adaptée au système et à l'installation existante avant cette étape ; ne pas remplacer une installation Certbot déjà utilisée par le site principal.

```bash
curl -I https://brain2jeu.leofinance.fr/
curl -I https://brain2jeu.leofinance.fr/sw.js
```

Ouvrir ensuite `https://brain2jeu.leofinance.fr/` et essayer les deux jeux. Vérifier qu'un fichier JS/CSS dans `/assets/` renvoie le bon type et un cache long, et que `/sw.js` renvoie `Cache-Control: no-store`. HTTPS active aussi le service worker et le mode hors connexion après la première visite complète.

## Mises à jour

Sur le PC, reconstruire avec `npm run release:vps` puis renvoyer l'archive et `install-release.sh`. Sur le VPS, relancer seulement la commande de l'étape 3. Ne pas réinstaller le fichier Nginx initial : Certbot y aura ajouté les réglages HTTPS. Un changement de fichiers statiques ne nécessite pas de rechargement Nginx.

Les fichiers HTML et le service worker sont revalidés ; les assets Vite ont des noms contenant leur empreinte et peuvent rester en cache. Actualiser un onglet déjà ouvert pour voir une nouvelle version.

Les progrès restent propres au navigateur et au domaine : les records de `localhost` ne sont pas transférés automatiquement au nouveau sous-domaine.

## Références

- [Nginx : noms de serveurs](https://nginx.org/en/docs/http/server_names.html)
- [Nginx : try_files](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files)
- [Nginx : test de configuration](https://nginx.org/en/docs/switches.html)
- [Certbot avec Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap)
- [Let's Encrypt : validation HTTP-01](https://letsencrypt.org/docs/challenge-types/#http-01-challenge)
