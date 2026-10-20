# Entwicklungs-Log

Ein Eintrag pro Arbeitstag. Meilensteine siehe [`CLAUDE.md`](../CLAUDE.md), Abschnitt 10.

---

## 2026-10-19 – Planung

**Meilenstein:** Vorbereitung vor M0

**Umgesetzt**
- Aufgabe analysiert und den Stack des Arbeitgebers (Next.js, TypeScript, NestJS, Supabase) als Grundlage gewählt.
- Projekt in mehreren Fragerunden mit Claude Code geplant: Umfang, Architektur, KI-Anbieter, Sicherheit, Tests, Deployment.
- `CLAUDE.md` (Root, `apps/web`, `apps/api`) als verbindliche Projektbeschreibung für den KI-Agenten geschrieben.
- Die Planung in zwei Review-Runden auf Machbarkeit, Sicherheit und Skalierbarkeit geprüft und überarbeitet.
- `README.md`, `docs/deployment.md` und die Grundstruktur des Monorepos angelegt.

**Wichtige Entscheidungen**
- Nur Login, keine Registrierung: Die Prüfer erhalten einen Demo-Account.
- Mistral als EU-Anbieter mit den günstigsten sinnvollen Modellen, Ollama für lokale Entwicklung.
- Meilensteine mit einem Deployment am Ende jedes Meilensteins.

**Probleme und Erkenntnisse**
- Im Review fielen unter anderem auf: umgehbare Limits durch Löschen, fehlendes Größenlimit für eingefügten Text, eine falsche Annahme zu Magic Bytes bei Textdateien und die Inkompatibilität von pg-boss mit dem Transaction-Pooler. Alles wurde vor dem ersten Code korrigiert.

**Nächster Schritt**
- Node.js und pnpm installieren, dann M0: Fundament.

---

## 2026-10-20 – Fundament

**Meilenstein:** M0 – alle Agent-Pakete fertig, Deployment (M0-DEP-01) offen

**Umgesetzt**
- Einrichtung: Node.js 24 und pnpm 12 (alles auf Laufwerk D:), Branch-Modell mit `dev` als Integrations- und `master` als Produktionsbranch, Supabase-Projekt `notebooklm-dev` in Frankfurt, Mistral-Konto mit API-Key.
- Welle 1: Workspace-Tooling, ADRs 0001–0003, Deployment-Konfiguration als Code (`railway.json`, `vercel.json`), gemeinsame Verträge für Fehlerformat, Limits und Health.
- M0-API-01: NestJS-Gerüst mit validierter Konfiguration, Helmet, CORS nur für die Web-Domain, Body-Limit 2 MB, Rate-Limit pro IP, globaler Zod-Validierung und RUN_MODE-Weiche.
- M0-API-02: Drizzle-Anbindung, Migration für pgvector, `GET /health` mit Datenbankprüfung, globaler Fehlerfilter im gemeinsamen Format, Request-ID pro Anfrage.
- M0-WEB-01: Next.js 16 mit Tailwind, shadcn/ui, TanStack Query, Design-Tokens und Startseite.
- Integration: 72 Tests grün, `/health` antwortet lokal mit `200` gegen Supabase dev, Helmet-Header, CORS und Fehlerformat von Hand geprüft.

**Arbeitsweise**
- M0-API-01 bewusst allein und nacheinander umgesetzt, um Ablauf und Review zu verstehen. Danach M0-WEB-01 und M0-API-02 parallel in eigenen Git-Worktrees. M0-API-02 wurde dafür aus Welle 3 vorgezogen, weil seine Abhängigkeiten erfüllt waren und sich die Dateien nicht überschneiden.
- Jeder Agent-Bericht wurde gegen Diff, Eigentumsdateien und Akzeptanzkriterien geprüft. Änderungen an fremden Dateien haben die Agents nur gemeldet, umgesetzt wurden sie gesammelt am Integrationspunkt.

**Wichtige Entscheidungen**
- Kein `@nestjs/config`: Ein eigenes Zod-Schema validiert die Umgebung, bevor Nest den Modulgraphen baut, weil `RUN_MODE` bestimmt, welche Module überhaupt geladen werden.
- NestJS 12 ist reines ESM, die API bleibt trotzdem CommonJS und lädt Nest über `require(esm)`.
- Neue Supabase-Schlüssel (publishable/secret) statt der Legacy-Keys. Die Variablennamen bleiben gleich.
- Mistral im kostenpflichtigen Plan statt im kostenlosen, damit hochgeladene Inhalte nicht ins Training fließen. Monatliches Ausgabelimit 10 €.
- Zeilenenden per `.gitattributes` einheitlich auf LF.
- pnpm 12 verlangt eine Entscheidung für jedes Paket mit Build-Skript: `esbuild` und `@swc/core` freigegeben, `unrs-resolver` bewusst abgelehnt.

**Probleme und Erkenntnisse**
- Supabase bot beim Anlegen zunächst nur „Europe“ an und wählte damit Irland. Die Region lässt sich nachträglich nicht ändern, deshalb wurde das Projekt gezielt in Frankfurt neu angelegt. Aufgefallen ist das über den Host des Connection-Strings.
- Die Env-Dateien wurden geprüft, ohne Werte auszugeben (nur gesetzt/leer, Format, HTTP-Status). So fielen eine falsch kopierte Projekt-URL und die falsche Region auf, ohne dass Secrets im Chat landeten.
- Ein Merge schien erfolgreich, obwohl das Paket noch nicht committet war („Already up to date“). Seitdem wird vor jedem Merge `git log` geprüft.
- `core.autocrlf` unter Windows ließ den Prettier-Check scheitern. Gelöst mit `.gitattributes` und `git add --renormalize`.
- Am Integrationspunkt nachgezogen: `X-Request-Id` per CORS für das Frontend freigegeben, `drizzle.config.ts` in den Typecheck aufgenommen, unbenutzte Serif-Schrift entfernt, Doku zu Fehlerformat und Logging aktualisiert.
- KI-Fehleinschätzung: Claude hielt `pnpm --filter api` für einen Doku-Widerspruch. Ein Test zeigte, dass pnpm den Kurznamen korrekt auflöst.

**Offen für M0-DEP-01**
- `drizzle-kit` ist eine devDependency, wird auf Railway aber beim Start für die Migration gebraucht.
- Prüfen, ob `trust proxy` mit einem Hop zu Railway passt, damit das Rate-Limit pro IP greift.

**Nächster Schritt**
- M0-DEP-01: Supabase `notebooklm-prod` (H-04), Railway (H-06), Vercel (H-07), `dev` nach `master`, Smoke-Test live.
