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
- **Keine Staging-Umgebung.** Erwogen wurde ein zusätzlicher Branch `stage` mit eigenem Deployment zwischen `dev` und `master`. Verworfen aus drei Gründen: Supabase Free erlaubt nur zwei aktive Projekte, ein drittes wäre kostenpflichtig. Eine Staging-API gegen die dev-Datenbank würde ab M3 Ingestion-Jobs aus derselben pg-boss-Queue ziehen wie die lokale API, sodass lokal hochgeladene Quellen von älterem Staging-Code verarbeitet werden könnten. Außerdem kostet jede zusätzliche Stufe pro Meilenstein ein weiteres Deployment samt Smoke-Test, bei ohnehin knappem Zeitbudget. Ersatz: Integrationspunkt auf `dev` gegen die echte dev-Datenbank, Smoke-Test nach jedem Produktions-Deployment, Rollback über Vercel und Railway. Festgehalten in `CLAUDE.md` §2 und §13 (ADR 4) sowie in `docs/deployment.md`.

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

**Stand M0-DEP-01**
- Erledigt: Supabase `notebooklm-prod` in Frankfurt (H-04), `dev` nach `master` gemergt und gepusht. Noch ohne Deployment, weil Railway und Vercel noch nicht verbunden sind.
- Railway hat Config as Code (`railway.json`) abgekündigt. Neue Services können sie seit 2026-08-28 nicht mehr nutzen, die Datei wäre also ignoriert worden. Aufgefallen ist das erst im Dashboard. `railway.json` wurde entfernt, die Werte stehen jetzt als Referenz für die Dashboard-Einstellungen in `docs/deployment.md`. Den Nachfolger „Infrastructure as Code“ habe ich verworfen, weil er eine neue Abhängigkeit und die CLI braucht und nicht beim Deployment angewendet wird.
- Railway legt bei einem pnpm-Workspace automatisch einen Service pro App an. Der Web-Service wurde gelöscht, weil das Frontend auf Vercel läuft.
- Bei der Wahl der Vercel-Domain kam die Frage nach dem Markenrecht auf. Die öffentliche App heißt jetzt **Quellenchat**, „NotebookLM“ wird nur noch beschreibend genannt, mit Markenhinweis im Footer und im README.
- Erster Deploy: Build, Migration und Healthcheck grün, die Domain lieferte aber `502`. Railway hatte `PORT` selbst auf 5432 gesetzt, den Port aus der `DATABASE_URL`. Gelöst mit `PORT=8080` und passendem Target Port der Domain.
- Offener Punkt drizzle-kit erledigt: Railway entfernt devDependencies nicht, `db:migrate` läuft beim Start durch.
- Offener Punkt `trust proxy` erledigt, gemessen nur über die Rate-Limit-Header, ohne IPs zu loggen. Verschiedene Client-IPs (Hotspot und LAN) bekommen getrennte Zähler, gefälschte `X-Forwarded-For`-Header werden ignoriert. Pro Client entstehen allerdings zwei abwechselnde Zähler, die Ursache ist ohne IP-Logging nicht belegbar. Das ist als bekannte Einschränkung dokumentiert.
- KI-Fehleinschätzung: Claude schloss aus einem ersten Netzwechsel-Test, das Limit zähle nach Proxy-IPs, und schlug einen eigenen Guard auf `X-Real-IP` vor. Der Test hatte aber keinen gültigen IP-Nachweis, weil der Pi-hole den IP-Echo-Dienst blockierte. Auf meinen Wunsch wurde mit Zeitstempeln und IP-Hash wiederholt, und das Ergebnis widerlegte den Befund. Lehre: Eine Messung zählt erst, wenn ihre Vorbedingungen belegt sind.
- Neues Paket M0-WEB-02 vor dem ersten Deployment: Impressum und Datenschutzerklärung. Die Anbieterangaben liegen in Env-Variablen, damit die Anschrift nicht im öffentlichen Repository steht. Ohne sie bricht der Vercel-Produktions-Build ab, lokal mit `VERCEL_ENV=production` geprüft. Beide Texte sind Entwürfe ohne Rechtsberatung und stehen auf der Checkliste vor der Abgabe.

**Nächster Schritt**
- Railway (H-06), Vercel (H-07), danach Smoke-Test live und README-Stand „M0 live“.
