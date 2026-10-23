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

**Meilenstein:** M0 – abgeschlossen und live (M0-DEP-01)

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

- Vercel übernahm beim Import den Repository-Namen und veröffentlichte zuerst unter `notebook-lm-clone-lyart.vercel.app`. Projekt in `quellenchat` umbenannt, Domain `quellenchat.vercel.app` hinzugefügt, alte Domain entfernt. Der Domain-Punkt fehlte in der Seitenleiste der Settings und war nur per direktem Link erreichbar.
- `ENABLE_EXPERIMENTAL_COREPACK=1` auf Vercel, damit dort wie auf Railway pnpm 12.14.0 aus `packageManager` baut.

**Smoke-Test live (M0-DEP-01)**
- `quellenchat.vercel.app`: Startseite, Impressum und Datenschutz liefern `200`, Funktionen in `fra1`.
- `GET quellenchat-api.up.railway.app/health` → `200` mit `database: up`.
- Helmet-Header vorhanden (CSP, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`), kein `X-Powered-By`.
- CORS: Preflight von der Web-Domain freigegeben, von fremder Origin nicht.
- Railway-Logs ohne Secrets.
- Konsole: einziger Fehler ist ein `404` beim Prefetch von `/login`. Die Login-Seite entsteht in M1-WEB-01, der Fehler verschwindet damit. Bewusst nicht mit `prefetch={false}` überdeckt.

**M1 – Welle 1 (M1-SH-01, M1-API-01, M1-WEB-01)**
- Drei Pakete parallel in eigenen Worktrees: Notebook-Verträge in `packages/shared`, Gerüst der API (Tabelle `notebooks` mit RLS ohne Policies, `@Public()`, `@CurrentUser()`, Modul-Stubs), Supabase-Login mit `proxy.ts`, Header mit Abmelden und typisiertem API-Client.
- Vor dem Start entschieden: Ein dev-Nutzer wurde von Hand im Supabase-Dashboard angelegt, damit der Login schon vor dem Seed-Skript (M1-W2) testbar ist. Die Weiterleitung angemeldeter Nutzer von `/` übernimmt `proxy.ts`, damit Startseite und ihr Test unverändert bleiben.
- `notebooks.user_id` verweist auf `auth.users` mit `ON DELETE CASCADE`. Löscht der Betreiber einen Account, verschwinden dessen Notebooks. Storage-Dateien erfasst die Kaskade nicht, das kommt ab M2 in die Betreiber-Doku. Festgehalten in `apps/api/CLAUDE.md`.
- Abmelden nur lokal (`scope: 'local'`): Die Prüfer teilen sich den Demo-Account, ein globaler Logout würde alle abmelden.
- Integrationspunkt: lint, typecheck und test grün, Migration ohne Änderung. Handtest gegen dev: Login, Weiterleitungen in beide Richtungen, deutsche Fehlermeldung bei falschem Passwort, kein `404` mehr beim Prefetch von `/login`. Den Logout-Button gibt es erst mit einer Seite unter `(app)` (M1-WEB-02), ersatzweise wurde das Löschen der Session-Cookies geprüft.
- RLS selbst gemessen statt dem Bericht geglaubt: Probe-Zeile angelegt, über die Supabase Data API mit dem publishable Key gelesen (0 Zeilen, Anlegen mit `401`/`42501` abgewiesen), danach gelöscht. Ein leeres Ergebnis auf einer leeren Tabelle hätte nichts bewiesen.

**Probleme und Erkenntnisse (M1-W1)**
- Auf C: waren nur noch 218 MB frei, weil `%TEMP%` und Windows-Systemdateien dort liegen. Mit `powercfg /h off` kamen 6,8 GB zurück. Die Auslagerungsdatei wuchs während der drei parallelen Agents um 2,5 GB.
- Ein API-Test war bei einem Agent unter Last rot. Am Integrationspunkt lief er grün, erst damit war die Vermutung „Last“ belegt.
- Der erwartete Lockfile-Konflikt blieb aus. Ob der automatische Merge stimmig war, zeigte erst `pnpm install` ohne Änderung am Lockfile.
- Leere Worktree-Ordner ließen sich nicht löschen („Device or resource busy“), solange ihre Agent-Sitzungen in der App nicht archiviert waren.
- Notiert für später: Standardrechte von `anon`/`authenticated` auf den Tabellen entziehen, darunter `TRUNCATE`, das RLS nicht erfasst (M5-API-01). Meldung des Abmelden-Buttons, wenn der Widerruf am Server scheitert (M5-WEB-01). Der Prod-Seed darf nicht auf die dev-`.env` zurückfallen (M1-API-04).

**Nächster Schritt**
- M1 – Welle 2: M1-API-02, M1-API-03, M1-API-04, M1-WEB-02. Vorher Neustart (Auslagerungsdatei) und H-09.

---

## 2026-10-21 – Login und Notebooks

**Meilenstein:** M1 – Welle 2 abgeschlossen, Deployment M1 steht aus

**Umgesetzt (M1-W2: M1-API-02, M1-API-03, M1-API-04, M1-WEB-02)**
- Globaler JWT-Guard: Signatur über die JWKS des Supabase-Projekts, Issuer, Audience `authenticated`, Pflicht-Claims `exp` und `sub`, nur `ES256`/`RS256`. Jede Ablehnung ist ein `401` ohne Grund. Ist die JWKS nicht erreichbar, antwortet die API mit `503`, damit ein Supabase-Ausfall die Nutzer nicht abmeldet.
- Notebooks-CRUD im Schichtenmodell. Jede Abfrage filtert nach `user_id`, fremde Notebooks ergeben `404` wie nicht vorhandene. Das 26. Notebook ergibt `429` mit `LIMIT_EXCEEDED`.
- Seed-Skript für den Demo-Account: idempotent, setzt das Passwort zurück, legt „Demo: Einführung“ neu an. `db:seed:prod` liest ausschließlich `.env.production` und bricht ab, wenn Datenbank und Supabase-URL zu verschiedenen Projekten gehören.
- Notebook-Übersicht mit Anlegen, Umbenennen und Löschen samt Bestätigung, Skeleton, Leer- und Fehlerzustand.

**Integrationspunkt**
- Nach dem Merge waren zwei Tests der Validierungs-Pipe rot, weil der neue Guard deren Testcontroller korrekt mit `401` abwies. Gelöst mit `@Public()` am Testcontroller, vorher reproduziert, danach 8 von 8 grün.
- Lint, Typecheck und Tests grün, Seed gegen dev erfolgreich.
- Ownership gegen die echte Datenbank geprüft, weil die Agent-Tests nur einen In-Memory-Ersatz nutzen: Mit dem echten Repository sieht, ändert und löscht ein zweiter Nutzer das Notebook des ersten nicht. Dieselben Abfragen finden es für den Eigentümer, sonst hätte das „nicht gefunden“ nichts bewiesen.
- `curl` gegen localhost: `/notebooks` ohne Token, mit gefälschtem und mit unsigniertem Token (`alg: none`) sowie `POST`, `PATCH` und `DELETE` ohne Token liefern `401`. `/health` bleibt öffentlich.
- Handtest im Browser: Login mit dem Demo-Account zeigt „Demo: Einführung“. Anlegen, Umbenennen, Löschen mit Nachfrage, Tastaturbedienung und Abmelden funktionieren.

**Probleme und Erkenntnisse**
- `pnpm install` ist bei parallelen Wellen ein Engpass. Jeder Agent führt den Befehl zu Beginn in seinem eigenen Worktree aus, alle gleichzeitig. Bei drei parallelen Agents (M1-W1) dauerte der erste Install laut Bericht von M1-SH-01 rund 11 Minuten, bei vier (M1-W2) laut Bericht von M1-API-02 28 Minuten. Vermutete Ursache, nicht gemessen: Alle Worktrees teilen sich den pnpm-Store unter `D:\.pnpm-store` und konkurrieren um dieselbe Platte.
- Idee für die nächsten Wellen, noch nicht erprobt: `pnpm install` in Schritt 1 direkt nach dem Anlegen jedes Worktrees nacheinander ausführen, bevor die Agents starten. Die Agents finden dann installierte Abhängigkeiten vor, und ihr eigener Install-Lauf ändert nichts mehr.
- Der Build-Plan nannte Testdateien `*.spec.ts`, die Vitest-Konfiguration sammelt aber nur `*.test.ts`. Solche Tests wären still nie gelaufen. Zwei Agents haben das erkannt und ihre Dateien `*.test.ts` genannt.
- Im ersten Handtest fehlte das Demo-Notebook. Die Ursache war kein Fehler: Angemeldet war der dev-Nutzer von gestern, nicht der Demo-Account. Belegt über den letzten Login pro Nutzer in der Datenbank, die Mandantentrennung hat dabei wie vorgesehen gegriffen.
- Notiert für später: Ein abgemeldetes Token bleibt bis zu seinem Ablauf gültig, weil die API lokal über die JWKS prüft (ADR 4, M6-OPS-02). Fokus nach dem Löschen und das englische „Close“ im generierten Dialog (M5-WEB-01). `drizzle.config.ts` füllt bei einer Migration mit `--env-file` fehlende Variablen aus der dev-`.env` auf. Auf Railway ist das unkritisch, weil es dort keine `.env`-Datei gibt.

**Nächster Schritt**
- M1-DEP-01: `apps/api/.env.production` anlegen, `dev` nach `master`, Prod-Seed, Smoke-Test live.

## 2026-10-21 (Abend) – Deployment M1 blockiert, M2 auf `dev`

**Meilenstein:** M1-DEP-01 offen (Railway-Störung), M2 auf `dev` vollständig integriert, Deployment M2 steht aus

**Deployment M1 (begonnen)**
- Vorbedingungen geprüft, ohne Werte auszugeben: `dev` gleich `origin/dev`; `apps/api/.env.production` vollständig, Datenbank und Supabase-URL gehören zum selben Projekt und nicht zu dev, Session-Pooler auf Port 5432; die JWKS von prod liefert einen `ES256`-Schlüssel, der Guard kann Prod-Tokens also prüfen.
- `dev` nach `master` gemergt und gepusht. Railway hat das Deployment nicht ausgeführt: Laut status.railway.com sind Builds und Deployments seit 07:24 UTC in allen Regionen pausiert, Dashboard und API eingeschränkt. Die Freigabe kommt stufenweise, Hobby nach Enterprise und Pro. Live läuft weiter die M0-API (`/notebooks` → `404`). Der Prod-Seed wartet, weil die Tabelle `notebooks` erst mit der Migration beim Start entsteht.
- Supabase war nicht betroffen: status.supabase.com meldete um 19:58 UTC alle Systeme in Betrieb, die JWKS von prod antwortete mit `200`.

**Bewusste Abweichung: M2 vor dem Live-Gang von M1**
- §10 sieht vor, einen Meilenstein erst nach dem Deployment des vorherigen zu beginnen. Wegen der Störung ohne absehbares Ende wurde M2 trotzdem auf `dev` umgesetzt. M2-W1 ist rein additiv (Verträge, zwei Tabellen mit RLS, leere Module) und wäre auch versehentlich live unkritisch.
- Regel dafür: Braucht M1 nach dem Smoke-Test einen Fix, entsteht er auf einem Branch von `master`, wird nach `master` und danach `master` nach `dev` gemergt. So geht nur der Fix live.
- M3 wird erst nach den Deployments von M1 und M2 begonnen, damit nicht drei Meilensteine ungetestet auf `dev` liegen.

**Umgesetzt (M2-W1 bis M2-W3)**
- Quellen-Verträge, Tabellen `sources` und `usage_events` mit RLS, Storage-Service mit Pfaden nur aus geprüften UUIDs, Typprüfung nach Inhalt, Upload-Limit in einer Transaktion mit Advisory-Lock, Sources-Endpunkte, Notebook-Ansicht mit Quellenliste und Dialog zum Hinzufügen.
- `usage_events.user_id` verweist auf `auth.users` mit `ON DELETE SET NULL`. Der Plan sagte „kein FK“, `CLAUDE.md` §4 verlangt aber, dass `user_id` beim Löschen eines Accounts `NULL` wird. Entschieden für den FK, Doku präzisiert: kein Fremdschlüssel zu Notebooks oder Quellen.

**Integrationspunkte**
- Nach jeder Welle lint, typecheck und test grün. Checks im Review in jedem Worktree selbst ausgeführt, nicht nur aus den Berichten übernommen.
- Advisory-Lock gegen die dev-Datenbank belegt: Zwei Transaktionen mit gleichem Schlüssel laufen nacheinander, mit verschiedenen Schlüsseln gleichzeitig. Die Gegenprobe zeigt, dass die Wartezeit vom Lock kommt und nicht vom Pool.
- Handtest nach W3: PDF, `.md` und eingefügter Text erscheinen mit „wartet“; eine in `.txt` umbenannte Binärdatei wird abgelehnt; die Dateien liegen unter `{userId}/{sourceId}` im Bucket und verschwinden beim Löschen der Quelle und des Notebooks.

**Probleme und Erkenntnisse**
- Zwei Agents haben die gemeinsame Test-App `apps/api/test/support/notebooks-test-app.ts` außerhalb ihres Eigentums angepasst, weil neue Module die Notebook-Tests sonst gebrochen hätten. Übernommen, weil minimal und nur für Tests. Für M3 sollte die Datei im Build-Plan einem Paket ausdrücklich gehören.
- `pnpm install` nacheinander vor dem Start der Agents erprobt: ca. 4:20 pro Install, bei drei Paketen rund 13 Minuten. Ein Vorteil gegenüber den parallelen Installs aus M1-W1 (laut Agent-Bericht rund 11 Minuten) ist damit nicht belegt. Der Vergleich ist unsicher, weil die alte Zahl aus einem Bericht stammt und der Zustand des pnpm-Stores unbekannt war.
- `git worktree remove` lässt unter Windows leere Ordner mit pnpm-Links zurück. Alle Links zeigten in den eigenen Restordner, `rm -rf` aus Git Bash entfernt sie gefahrlos.
- Die Statustabelle im Build-Plan zählt 48 Pakete und 75,75 h, Abschnitt 9 nennt 47 und 75,0 h.

**Nächster Schritt**
- Sobald Railway Hobby-Builds wieder freigibt: Deployment für `master` prüfen oder „Deploy Latest Commit“ auslösen, Migrations-Log, `db:seed:prod`, Smoke-Test M1, README-Stand, Status M1-DEP-01.
- Danach M2-DEP-01: `dev` nach `master`, Migrationen `0003`/`0004` im Log, Smoke-Test M2 live. Der Bucket `sources` in prod ist angelegt.

## 2026-10-22 – Sicherheitsvorfall bei Railway, Secrets rotiert

**Meilenstein:** M1-DEP-01 weiter blockiert, M2 wartet auf `dev`

**Vorfall**
- Die Railway-Störung vom Vortag war ein Sicherheitsvorfall: Laut Railway hat ein Dritter möglicherweise auf die gespeicherten Umgebungsvariablen zugegriffen und einen Teil davon entschlüsselt. Railway empfiehlt allen Nutzern, sämtliche Variablen zu ersetzen und die Logs zu prüfen. Builds für Hobby sind noch gesperrt (Stand 08:01 UTC: nur Enterprise und Pro).
- Betroffen waren drei Secrets in Railway: `MISTRAL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` und das DB-Passwort von prod in `DATABASE_URL`. `SUPABASE_URL`, `WEB_ORIGIN`, `PORT` und `RUN_MODE` sind nicht geheim. Nicht betroffen: die Demo-Zugangsdaten (nur lokal), das dev-Projekt, die JWT-Signaturschlüssel von Supabase, Vercel.

**Maßnahmen**
- Sofort rotiert, ohne auf die Builds zu warten, damit die alten Werte nicht weiter nutzbar sind: Mistral-Key widerrufen und neu angelegt, neuer `sb_secret_`-Key in prod und alter gelöscht, DB-Passwort von prod zurückgesetzt. Neue Werte in Railway und in `apps/api/.env.production` eingetragen, nie im Chat oder Repository.
- Bewusst in Kauf genommen: Die laufende M0-API kommt mit dem alten Passwort nicht mehr in die Datenbank (`/health` → `503`, `database: down`), bis Railway wieder deployen kann. Die Demo hatte noch keine Nutzer.
- Prod-Datenbank lesend auf Missbrauch geprüft, nur Anzahlen und Zeitpunkte ausgegeben: keine Nutzer in `auth.users`, keine Tabellen in `public` (erwartet vor Migration `0001`), Storage leer, Bucket `sources` privat, keine unerwarteten Rollen mit Login.

**Probleme und Erkenntnisse**
- Nach dem ersten Passwort-Reset meldete der Pooler `28P01`. Format und Einlesen der `DATABASE_URL` waren nachweislich korrekt (gleicher Wert wie in der Datei, eine Zeile, richtiger Benutzer und Host, dev unverändert erreichbar). Ein zweiter, bestätigter Reset löste es. Vermutlich war der erste Reset nicht gespeichert worden.
- Die Prüfung gegen prod lief als vom Entwickler ausgeführtes Skript: Direkte Lesezugriffe der KI auf Produktivdaten blockiert die Rechteprüfung, und das ist gewollt.
- Der Vorfall bestätigt zwei Entscheidungen: Secrets liegen nur in Umgebungsvariablen und sind deshalb ohne Codeänderung austauschbar, und RLS ohne Policies hätte einen gestohlenen publishable Key wirkungslos gemacht. Ein gestohlener Service-Key oder ein DB-Passwort umgeht RLS dagegen. Deshalb war die Rotation nötig.

**Nächster Schritt**
- Sobald Railway Hobby-Builds freigibt: M1-DEP-01 fortsetzen. Das erste Deployment übernimmt die neuen Secrets.
- Bewusst weiter mit M3 auf `dev`, die Deployments folgen einzeln: M1 steht auf `master`, M2 wird gezielt bis zum Commit `2062c5b` nach `master` gemergt (Stand M2 ohne M3), erst danach M3. So bekommt jeder Meilenstein seinen eigenen Smoke-Test.
- `apps/api/test/support/**` gehört ab M3 ausdrücklich M3-API-04, damit die gemeinsame Test-App nicht wieder außerhalb des Eigentums geändert wird.

## 2026-10-22 (Nachmittag) – Ingestion auf `dev`

**Meilenstein:** M3 – Wellen 1 bis 3 auf `dev` integriert, M3-DEP-01 offen. M1-DEP-01 weiter blockiert (Railway, Stand 12:30 UTC: Hobby-Builds gesperrt)

**Umgesetzt (M3-W1: M3-API-01, M3-WEB-01)**
- Tabelle `chunks` mit `vector(1024)`, RLS ohne Policies, Fremdschlüssel auf `sources` und `notebooks` mit `ON DELETE CASCADE`, Indizes auf `notebook_id`, `user_id` und `source_id`. Bewusst ohne Vektorindex, weil die Suche exakt ist (§9). Gegen die dev-Datenbank geprüft, nicht nur aus dem Bericht übernommen.
- Gerüst für Queue, LLM und Ingestion. Die App startet in allen drei `RUN_MODE`s. Welche Module laden, wurde pro Modus am Build verglichen: `worker` bedient nur `/health`, `api` lädt keine Ingestion.
- Web pollt alle 2 Sekunden, solange eine Quelle wartet oder verarbeitet wird, und zeigt bei „fehlgeschlagen“ den Grund. Handtest mit einem Skript außerhalb des Repositorys, das in dev den noch fehlenden Worker nachspielte: Status wechselt ohne Reload, das Polling stoppt, der Hinweis erscheint per Maus und per Tastatur.

**Umgesetzt (M3-W2: M3-API-02, M3-API-03, M3-API-04)**
- Textextraktion seitenweise, Chunking nach Zeichen (höchstens 3.000, 400 Überlappung).
- Embedding-Provider für OpenAI-kompatible APIs mit Batches und Backoff bei `429` und `5xx`.
- pg-boss-Queue: Ein Upload reiht `ingest-source` ein, ein täglicher Job räumt `usage_events` auf. Scheitert das Einreihen, entfernt der Service Datei und Zeile wieder, sonst bliebe die Quelle für immer auf „wartet“. Das Kontingent bleibt verbraucht.
- Ein Upload in dev erzeugte genau einen Job: drei Wiederholungen mit 30 Sekunden Abstand und Backoff, `singletonKey` gleich der `sourceId`, als Nutzlast nur `sourceId` und `userId`. Dokumentinhalte landen also nicht in den pg-boss-Tabellen.

**Umgesetzt (M3-W3: M3-API-05, M3-API-06)**
- Worker mit eigenem Repository unter `ingestion/`. In der Transaktion wird zuerst der Status `ready` gesetzt. Das sperrt die Zeile gegen ein gleichzeitiges Löschen. Danach folgen die Chunks in Paketen zu 100. Ergeben sich 0 Chunks, endet die Quelle als „fehlgeschlagen“ mit der Meldung zu fehlendem lesbarem Text. Auslöser war ein Hinweis aus dem Review von M3-API-02: Text nur aus unsichtbaren Zeichen besteht die Extraktion, ergibt aber keinen Abschnitt. Eine zwischenzeitlich gelöschte Quelle beendet den Job still. Geloggt werden nur IDs, Dauer, Anzahl der Chunks und Fehlerklasse.
- Seed als Nest-Application-Context mit `AppConfig`, `Db`, `Storage` und `Queue`, fest mit `RUN_MODE=api` und ohne `IngestionModule`. Ablauf: Storage des Demo-Accounts leeren, Notebooks ersetzen, Beispielquelle hochladen, Status `pending`, Job einreihen. Verarbeiten muss ihn die laufende API. Der Seed schreibt kein `usage_event`, weil er eine Betreiberaktion ist.
- Die Beispielquelle ist selbst verfasst. Sie enthält einen Fakt, den kein Modell aus dem Training kennen kann (das Maskottchen ist eine Eule namens Fidelia). So zeigt die Demo-Frage im Loom-Video, dass die Antwort aus der Quelle stammt.

**Integrationspunkte**
- Checks nach jeder Welle in jedem Worktree selbst ausgeführt, den Zuwachs pro Paket notiert und nach dem Merge die Summe geprüft. API-Tests: 288 nach W1, 382 nach W2 (385 mit Fix), 424 nach W3. Dazu 95 Web- und 40 Shared-Tests.
- Vorbedingungen für den Test in W3 belegt, ohne Werte auszugeben: Der Mistral-Key ist gültig (`GET /v1/models` → `200`), die Projekt-Ref der dev-`.env` ist eine andere als die von prod.
- Ende-zu-Ende in dev: Eine dreiseitige Text-PDF wird „bereit“, mit 3 Chunks auf den Seiten 1 bis 3. Eine PDF ohne Textebene wird „fehlgeschlagen“, mit verständlicher Meldung. Markdown wird „bereit“, ohne Seitenzahl. In `chunks` passen `notebook_id` und `user_id` zur Quelle, es gibt keine Duplikate und keine „bereit“-Quelle ohne Chunks. Alle Jobs sind `completed`, ohne Wiederholung.
- Der erneute Seed legt die Beispielquelle an, und der API-Prozess verarbeitet sie, nicht der Seed. Die Logs enthalten nur IDs, Status, Dauer und Fehlerklasse.

**Probleme und Erkenntnisse**
- Das Review fand einen Fehler, den die grünen Tests nicht zeigten: Der Aufräum-Job hing in `LimitsModule`, und das lädt nur im HTTP-Teil. Im Modus `worker` wäre er nie gelaufen. Damit hätte die Trennung von API und Worker „ohne Codeänderung“ (§9) nicht gestimmt. Belegt durch den Start in allen drei Modi, behoben am Integrationspunkt: `LimitsModule` lädt jetzt immer, es hat keinen Controller. Der neue Test war vorher genau für `worker` rot.
- Vor W3 das Eigentum gegen den Code abgeglichen und zwei Lücken gefunden. Erstens startet die gemeinsame Test-App das `AppModule` im Modus `all`, und die `FakeQueue` braucht dann `work`. `test/support/**` ging deshalb an M3-API-05. Zweitens läuft der Seed unter `tsx`, und `tsx` erzeugt keine Decorator-Metadaten. Das wurde gemessen, mit Gegenprobe gegen den Build von `nest build`. Vor dem Start der Agents behoben: `QueueService` nennt seine Abhängigkeit per `@Inject`, der Test dazu war vorher rot. Ohne den Abgleich hätten beide Agents außerhalb ihres Eigentums arbeiten müssen oder einen Fehler gesucht, den ihre Tests nicht zeigen.
- M3-API-04 hat den Test der Validierungs-Pipe außerhalb seines Eigentums angepasst, weil der Test das ganze `AppModule` startet und pg-boss sonst die Datenbank erreicht hätte. Übernommen, weil minimal und nur für Tests.
- pg-boss 12 ist ein reines ESM-Paket, die API bleibt CommonJS. `require(esm)` funktioniert unter Node 24. pg-boss verlangt mindestens Node 22.12, deshalb muss im Railway-Build-Log Node 24 stehen (M3-DEP-01).
- Nicht messbar unter Windows: ob pg-boss sauber herunterfährt. `SIGINT` aus Git Bash erreicht `node.exe` nicht zuverlässig, deshalb wurde daraus kein Schluss gezogen. Geprüft wird es im Railway-Log, wo der Prozess `SIGTERM` bekommt.
- Eigener Fehler in der Reihenfolge: Der Seed lief vor der Prüfung der Chunks und hat die Test-Uploads gelöscht, weil er alle Notebooks des Demo-Accounts ersetzt. Die Prüfung wurde in einem neuen Notebook nachgeholt. Regel seitdem: Prüfungen in der Datenbank immer vor Aktionen, die Daten zurücksetzen.
- Aufräumen: Ein hängender Befehl eines Agents (`cat >` ohne Eingabe) verhinderte das Archivieren seiner Sitzung. Nach dem Beenden des Prozesses ließ sie sich archivieren. `git worktree remove` scheiterte, solange `pnpm dev` im Hauptcheckout lief: pnpm verknüpft Dateien per Hardlink über alle Checkouts, und ein laufendes `esbuild.exe` sperrt sie auch im Worktree.
- KI-Fehleinschätzung: Claude hatte nach W1 und W2 angegeben, `pnpm dev` im Hauptcheckout halte die Worktrees nicht fest. Das war falsch, siehe den Punkt davor.
- Notiert für später: Läuft ein Job in den Timeout von pg-boss (Standard 15 Minuten), wird der Handler nicht mehr aufgerufen, und die Quelle könnte auf „wird verarbeitet“ stehen bleiben. Bei M5-API-01 prüfen, ob das realistisch ist. `withBackoff` wiederholt keine Verbindungsabbrüche, die fängt der Retry von pg-boss ab (ggf. in ADR 3 erwähnen). Hat der Seed das Passwort zurückgesetzt und hält der Browser noch ein altes Cookie, loggt `apps/web` `AuthApiError refresh_token_not_found` als Fehler. Das wird in M5-WEB-01 sauber behandelt.

**Nächster Schritt**
- Sobald Railway Hobby-Builds freigibt: M1-DEP-01, danach M2-DEP-01 (gezielt bis `2062c5b`), erst dann M3-DEP-01. Jeder Meilenstein bekommt seinen eigenen Smoke-Test.
- Der Seed auf `dev` setzt die Tabellen `sources` und `chunks` voraus und legt ein pg-boss-Schema an. Der Prod-Seed läuft deshalb immer aus dem Code, der gerade auf `master` deployt ist, in einem temporären Worktree von `master`, nie aus dem Hauptcheckout auf `dev`.
- Die Testdateien für den Smoke-Test von M3 (dreiseitige Text-PDF, PDF ohne Text, Markdown) liegen außerhalb des Repositorys und bleiben bis M3-DEP-01 aufbewahrt.
