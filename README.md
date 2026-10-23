# Ledger

Ledger is a personal finance dashboard built with React, TypeScript, and Vite as a Power Apps Code App. It connects to Dataverse for profile-scoped financial data.

## Features

- Overview of accounts, transactions, budgets, savings goals, investments, and reports
- Create and manage financial records for a selected profile
- Charts and report downloads in CSV, PDF (through the browser print dialog), and Word-compatible formats
- Dataverse-backed data access through the Power Apps Code Apps runtime

## Prerequisites

- Node.js (use an active LTS release)
- npm
- Git
- A Power Platform environment with code apps enabled and access to the Dataverse connection used by the app

## Create a Code App project

For a new Power Apps Code App, follow Microsoft's [Quickstart: Create a Code App from scratch](https://learn.microsoft.com/en-gb/power-apps/developer/code-apps/how-to/create-an-app-from-scratch). The quickstart covers creating a Vite app, initializing it with the Power Apps CLI, running it locally, and publishing it.

The basic project setup is:

```sh
npx degit github:microsoft/PowerAppsCodeApps/templates/vite my-app
cd my-app
npm install --global @microsoft/power-apps-cli
npm install --global @microsoft/power-apps
npm install
pa app init
```

Sign in when prompted and initialize the app for your Power Platform environment. To run it in the Power Apps local development context, use:

```sh
pa app run
```

For this repository, clone or download the project instead of scaffolding a new Vite template, then follow the [local development](#local-development) and [Power Platform configuration](#power-platform-configuration) instructions below.

## Dataverse as the database

This app uses **Microsoft Dataverse as its cloud database**. Financial data is stored in Dataverse tables, including transactions, user profiles, financial accounts, categories, budgets, savings goals and contributions, investments, and investment transactions. The generated table metadata in `.power/schemas/` describes the connected data sources and their fields.

The app accesses Dataverse through the `@microsoft/power-apps/data` client and the Power Apps Code Apps connection configured for the environment. Services in `src/services/` read and write the tables through that client; they do not connect directly to a database server or contain database credentials. Financial records are associated with a selected user profile so the app can retrieve the corresponding profile's data.

To connect or add Dataverse data sources in a Code App, see Microsoft's guide to [adding data sources to a code app](https://learn.microsoft.com/en-gb/power-apps/developer/code-apps/how-to/connect-to-data).

## Local development

Install the locked dependencies and start the Vite development server:

```sh
npm ci
npm run dev
```

Run the project checks:

```sh
npm run lint
npm run build
```

## Power Platform configuration

`power.config.json` and `.power/schemas/` contain the Power Apps Code App configuration and Dataverse schema metadata used by the project. The environment-specific `power.config.json` is intentionally ignored because this repository is public.

To configure a local Power Platform environment, copy `power.config.example.json` to `power.config.json` and replace the app, environment, and connection-reference placeholders with values from your environment. Keep the configuration aligned with the Dataverse tables used by the app.

Do not commit credentials, access tokens, or local environment files. The repository `.gitignore` excludes common local secrets, dependencies, and generated build/test output. If environment-specific local settings are needed, use an ignored `.env` file and document only non-secret variable names in a committed `.env.example`.
