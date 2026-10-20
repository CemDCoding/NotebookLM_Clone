# ADR 0001: Monorepo mit separatem NestJS-Backend und Datenzugriff nur über die API

- **Status:** Angenommen
- **Datum:** 2026-10-19

## Kontext

Das Projekt besteht aus einem Frontend, einem Backend mit Ingestion-Worker und Verträgen, die beide Seiten teilen (Request- und Response-Formate, SSE-Events, Limits). Der Stack des Arbeitgebers ist Next.js, NestJS und Supabase. Die Antworten werden gestreamt, und die Ingestion läuft länger als eine übliche Request-Dauer. Sicherheit ist ein Bewertungskriterium: Der Browser soll keinen direkten Zugriff auf Daten, Dateien oder KI-Anbieter haben. Die Zeit ist knapp, zusätzliches Tooling ist teuer.

## Entscheidung

Das Projekt ist ein **pnpm-Workspace** mit `apps/web` (Next.js), `apps/api` (NestJS) und `packages/shared` (Zod-Schemas, Typen, Konstanten). Das Frontend nutzt Supabase **nur für den Login**. Alle Daten laufen über die NestJS-API, die als einzige Stelle Datenbank, Storage und KI-Anbieter anspricht. Der Browser ruft die API direkt auf.

## Alternativen

| Alternative | Warum nicht gewählt |
|---|---|
| Nur Next.js mit Route Handlers und Server Actions | Weicht vom Arbeitgeber-Stack ab. Vercel-Funktionen haben Laufzeitgrenzen, die Streaming und Ingestion erschweren. |
| Frontend greift direkt auf Supabase zu (Row Level Security als einzige Absicherung) | Geschäftslogik, Limits und Prompt-Aufbau lägen im Client oder in Datenbankfunktionen. Schwer zu testen und zu prüfen. |
| Zwei getrennte Repositories | Geteilte Verträge müssten veröffentlicht und versioniert werden. Mehr Aufwand ohne Nutzen. |
| Nx oder Turborepo | Zusätzliches Build-Tooling, das bei drei Paketen keinen Mehrwert bringt. |

## Konsequenzen

- **Positiv:** Ein API-Vertrag als Zod-Schema, auf beiden Seiten verwendet. Ein zentraler Ort für Autorisierung, Limits und Logging. Streaming ohne Funktionstimeouts, weil der Browser die API direkt anspricht.
- **Negativ / Kompromisse:** Zwei Deployments (Vercel und Railway) statt einem. CORS muss konfiguriert werden. `packages/shared` braucht einen eigenen Build (`tsup`, ESM und CJS), damit Next.js und NestJS es einbinden können.
- **Weg in die Produktion:** Die API ist zustandslos und lässt sich horizontal skalieren. Der Worker kann per `RUN_MODE` als eigener Service laufen (siehe ADR 0002).
