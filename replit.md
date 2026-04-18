# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Current App

Margie’s Barge Report is a mobile-first React web app for the Kinney Lake House on Lake Lanier. It uses the shared Express API server and Replit PostgreSQL database for dock status, maintenance tasks, calendar bookings, bring-next-time items, issue tracking, settings, and activity logs.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (`artifacts/margies-barge-report`)
- **API framework**: Express 5 (`artifacts/api-server`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db/src/schema/barge.ts`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **External live data**: USGS Lake Lanier water level and National Weather Service forecast are fetched server-side without API keys

## Key Features

- Dock tab with lake level status, safe-zone clearance, lake history graph, weather forecast, dock adjustment logging, and settings
- Tasks tab with seasonal task logic, due status chips, task completion logging, and add-new-task flow
- Calendar tab with family booking creation/removal and conscience-check confirmations
- Bring tab with shared supplies list and mark-brought activity logging
- Issues tab with photo URL/data upload support, urgent flagging, open/all views, and resolution flow
- Log tab with generated activity entries across all major app actions

## Integration Notes

The first build keeps core in-app flows functional on the built-in database. Google Calendar sync, Resend emails, and Supabase Storage-style photo hosting are represented in the UI as pending integrations and can be wired once the user connects/authorizes those services.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/margies-barge-report run dev` — run the Margie’s Barge Report web app

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
