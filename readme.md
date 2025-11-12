# 🧪 OneKamer.co – Front-End (LAB)

## 🌍 Description
Version **de test et de développement** de l’application **PWA OneKamer.co**, développée avec **React + Vite + Windsurf**  
et connectée à l’API **Render (LAB)**, à **Supabase (DEV)** et à **BunnyCDN**.  

Cette version permet de tester les nouvelles fonctionnalités, intégrer les évolutions du backend,  
et valider les connexions Stripe ↔ Supabase avant le déploiement en production.

---

## 🧠 Architecture & Environnement

| Composant | Technologie | Hébergement |
|------------|-------------|--------------|
| Front-End (PWA) | React + Vite + Windsurf | Environnement local / test |
| Backend API | Node.js / Express | Render (LAB) |
| Base de données | Supabase (DEV) | Supabase Cloud |
| Stockage médias | BunnyCDN (Edge Storage + CDN) | Bunny.net |
| Paiement | Stripe (Mode test) | Render (LAB) |
| Authentification | Supabase Auth (DEV) | Supabase |

---

## ⚙️ Fonctionnalités principales

```markdown
### Fonctionnalités principales

- Connexion sécurisée via **Supabase Auth (mode test)**
- Gestion des profils et plans d’abonnement (environnement LAB)
- Paiements simulés via **Stripe Test Mode**
- Synchronisation des données via l’API Render (LAB)
- Affichage et logique dynamique selon les plans (`plan_features`)
- Intégration et chargement média via **BunnyCDN**
- Interface PWA installable et responsive
- Support OK COINS (tests de flux et crédits)

### Variables d’environnement

VITE_SUPABASE_URL=<url_supabase_dev>  
VITE_SUPABASE_ANON_KEY=<cle_anon_supabase_dev>  
VITE_RENDER_API_URL=https://onekamer-server-lab.onrender.com  
VITE_BUNNY_CDN_URL=https://onekamer-media-cdn.b-cdn.net  
VITE_STRIPE_PUBLIC_KEY=<cle_publique_stripe_test>

### Commandes utiles

# Installation des dépendances
npm install

# Lancement du serveur de développement
npm run dev

# Construction du build de test
npm run build

# Prévisualisation du build (facultatif)
npm run preview

### 🌐 Déploiement

L’application **LAB** est déployée automatiquement sur **Render** à l’adresse suivante :  
👉 [https://onekamer-front-lab.onrender.com](https://onekamer-front-lab.onrender.com)

### Structure du projet

onekamer-front-lab/
├── public/                 # Manifest & assets PWA
├── src/
│   ├── components/         # Composants UI réutilisables
│   ├── pages/              # Pages principales de l’application
│   ├── contexts/           # Contexts globaux (auth, profil, etc.)
│   ├── lib/                # Clients API (Supabase, Stripe)
│   └── styles/             # Feuilles de style globales
├── package.json            # Métadonnées du projet
├── vite.config.js          # Configuration Vite
└── README.md               # Documentation (ce fichier)

### Auteurs

Développé par **William Soppo** & **Annaëlle Bilounga**  
© 2025 **OneKamer SAS** — Tous droits réservés.  

### Licence

Version de test interne – Propriété OneKamer SAS.  
Ce code est réservé aux environnements de développement et ne doit pas être diffusé ni utilisé en production.
