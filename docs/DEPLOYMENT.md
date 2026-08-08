# Guide de Déploiement Gratuit — Démo EdTemps (Mandat `hoshy.dev@gmail.com`)

Ce guide explique comment mettre en ligne la plateforme **EdTemps** en 0 € avec **Render.com** (API & PostgreSQL) et **Vercel / Cloudflare Pages** (Frontend Web React).

---

## 1. Déploiement de l'API & Base PostgreSQL (0 € / mois)

1. Connectez-vous sur **[Render.com](https://dashboard.render.com)** avec votre compte **`hoshy.dev@gmail.com`** (ou via votre compte GitHub associé).
2. Cliquez sur **New +** → **Blueprint**.
3. Connectez le dépôt GitHub `edtemps`.
4. Render va détecter le fichier [`render.yaml`](file:///Users/richard/Developer/edtemps/render.yaml) à la racine.
5. Cliquez sur **Apply**. Render va automatiquement créer :
   - La base de données PostgreSQL gratuite (`edtemps-db`).
   - Le service web API Node.js/Fastify (`edtemps-api`).

> L'URL de votre API sera immédiatement disponible (ex: `https://edtemps-api.onrender.com`).

---

## 2. Déploiement de l'Interface Web Frontend (0 € / mois)

1. Connectez-vous sur **[Vercel.com](https://vercel.com)** avec votre compte **`hoshy.dev@gmail.com`**.
2. Cliquez sur **Add New...** → **Project**.
3. Importez le dépôt GitHub `edtemps`.
4. Vercel détecte automatiquement la configuration [`vercel.json`](file:///Users/richard/Developer/edtemps/vercel.json).
5. (Optionnel) Dans les variables d'environnement Vercel, ajoutez :
   - `VITE_API_URL` = `https://edtemps-api.onrender.com`
6. Cliquez sur **Deploy**.

> Votre démo publique est désormais **en ligne et 100% fonctionnelle sur un domaine HTTPS gratuit !**
