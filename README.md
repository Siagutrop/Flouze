# Flouze

Application web (PWA) auto-hébergée de gestion budgétaire personnelle et familiale,
basée sur le système d'enveloppes.

## Fonctionnalités

- **Espaces perso & foyer** : chaque entité (compte, enveloppe, budget, objectif…)
  est soit personnelle (visible par soi seul), soit du foyer (tous les membres)
- **Budget mensuel par enveloppes** : génération automatique en brouillon au jour
  paramétrable, pré-rempli par les opérations récurrentes + reports de solde,
  validation manuelle ou activation auto au 1er du mois, clôture figeant
  l'historique, transferts entre enveloppes
- **Transactions** : dépenses, revenus, virements inter-comptes ; audit trail
- **Récurrents** : hebdo/mensuel/trimestriel/annuel, matérialisés à la génération
- **Crédits & objectifs d'épargne** avec progression
- **Dashboard temps réel** (SSE) : soldes, dépenses mensuelles, non attribué
- **Import CSV** (colonnes date/libellé/montant ou débit/crédit auto-détectées)
  et **export** CSV + backup JSON complet du foyer

## Stack

- **Frontend** : React + Vite + TypeScript + Tailwind + PWA (i18n-ready)
- **Backend** : NestJS + Prisma + JWT
- **Base de données** : PostgreSQL 16
- **Déploiement** : Docker Compose

## Sauvegardes

- Export applicatif : `GET /api/v1/export/backup.json` (bouton dans Comptes)
- Dump base (Docker) : `docker compose exec db pg_dump -U flouze flouze > backup.sql`

## Démarrage

### Avec Docker (production / auto-hébergement)

```bash
cp .env.example .env   # adapter les secrets
docker compose up -d --build
```

L'application est disponible sur `http://localhost` (port configurable via `WEB_PORT`).

### Sans Docker (développement)

Un PostgreSQL **embarqué** est démarré automatiquement par le script de dev
(aucune installation nécessaire, données persistantes dans `backend/.pgdata`).

```bash
# Terminal 1 — base de données + API (watch)
cd backend
npm install
npm run dev        # Postgres embarqué :55433 + migrations + API :3000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxy /api -> :3000)
```

Prérequis : Node.js >= 20 uniquement. Si les binaires PostgreSQL ne démarrent
pas (postinstall bloqué), exécuter :
`node node_modules/@embedded-postgres/windows-x64/scripts/hydrate-symlinks.js`

## Structure

```
backend/   API REST NestJS (auth, foyers, budget, transactions...)
frontend/  PWA React
docs/      Documentation (modèle de données, API)
```

## Contribution — packs communautaires

- **Langues** : ajouter un fichier `frontend/src/locales/<lang>.json` et
  référencer la langue dans `frontend/src/i18n.ts`.
- **Devises** : les devises sont déclarées en base (table `currencies`,
  code ISO 4217 + nombre de décimales + symbole). Voir `backend/prisma/seed.ts`.
