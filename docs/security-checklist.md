# Sicherheits- und Limit-Checkliste

**Stand:** 2026-10-23 · **Erstellt in:** M5-API-01 · **Grundlage:** [`CLAUDE.md` §7](../CLAUDE.md), [`apps/api/CLAUDE.md`](../apps/api/CLAUDE.md), Abdeckungsmatrix in [`docs/build-plan.md` §12](build-plan.md)

Diese Datei hat zwei Teile:

1. **Nachweise:** Für jede Regel aus `CLAUDE.md` §7 steht hier, wo sie im Code umgesetzt und wodurch sie belegt ist (Test, Datei oder früherer Smoke-Test). Ist etwas nicht belegt, steht es als offener Punkt in Abschnitt 3.
2. **Live-Checkliste:** Abschnitt 4 ist der Smoke-Test für M5-DEP-01 gegen die Produktion.

Pfade zu Tests sind relativ zu `apps/api/`, wenn nicht anders angegeben.

---

## 1. Nachweise im Code

Status: **Test** = durch einen automatischen Test belegt · **Datei** = per Code-Review belegt, kein eigener Test · **Live** = nur in der Produktion prüfbar, siehe Abschnitt 4 · **Offen** = siehe Abschnitt 3.

### Authentifizierung und Autorisierung

| Regel | Umsetzung | Nachweis | Status |
|---|---|---|---|
| JWT auf allen Endpunkten außer `GET /health`, globaler Guard | `src/auth/auth.module.ts` (`APP_GUARD`), `src/auth/jwt-auth.guard.ts`, `@Public()` nur in `src/health/health.controller.ts` | `test/auth-guard.test.ts` (kein, abgelaufenes, gefälschtes, `alg: none`-, HS256-Token, falsche Audience → `401`). **Neu:** `src/app.module.test.ts` „Routes of all controllers“ prüft alle Controller aller `RUN_MODE`s: einzige öffentliche Route ist `HealthController.check` | Test |
| `userId` kommt nur aus dem Token | `src/common/decorators/current-user.decorator.ts` | `src/common/decorators/current-user.decorator.test.ts` | Test |
| Jede Abfrage filtert nach `user_id` | Alle Repositories (`src/**/*.repository.ts`, `src/db/seed/drizzle-*.ts`) | **Neu:** `test/tenant-isolation.test.ts` führt jede Methode jedes Repositorys gegen eine Drizzle-Instanz aus, die nur das erzeugte SQL aufzeichnet. Jede Tabelle in `FROM`, `JOIN`, `UPDATE` und `DELETE` muss über `user_id` mit der ID des Nutzers verglichen werden, jedes `INSERT` muss sie schreiben. Ein Vollständigkeitstest schlägt fehl, sobald eine neue Repository-Methode nicht erfasst ist. Bewusst global und deshalb ausgenommen: die globalen Tageszähler in `UsageEventsRepository.countSince` ohne Nutzer, der Aufräum-Job `src/limits/usage-cleanup.job.ts`, die Advisory-Locks in `src/limits/limit-transactions.ts` und `select 1` im Health-Check | Test |
| Fremde Ressource → `404`, nicht `403` | Services prüfen zuerst die Ownership, Repositories filtern nach `userId` | `test/ownership.test.ts` (Notebooks), `src/sources/sources.controller.test.ts` (Quellen), `src/chat/chat.service.test.ts` (Chat, Verlauf), `src/retrieval/retrieval.service.test.ts`, `src/ingestion/ingestion.worker.test.ts` | Test |
| RLS auf allen Tabellen, keine Policies | `src/db/migrations/0002`, `0004`, `0006`, `0008` | **Neu:** `src/db/rls.test.ts`: jede Tabelle aus `schema.ts` hat `ENABLE ROW LEVEL SECURITY`, keine Migration enthält `DISABLE`, `CREATE POLICY` oder `GRANT`. Live geprüft im Smoke-Test vom 2026-10-23 | Test, Live |
| Privater Bucket, Pfad `{userId}/{sourceId}` | `src/storage/storage.service.ts` (`sourceObjectPath` akzeptiert nur UUIDs) | `src/storage/storage.service.test.ts`. Bucket-Einstellung live geprüft am 2026-10-23 | Test, Live |

### Login ohne Registrierung und Demo-Account

| Regel | Umsetzung | Nachweis | Status |
|---|---|---|---|
| Registrierung in Supabase abgeschaltet | Einstellung im Supabase-Dashboard (H-03/H-04) | Smoke-Test vom 2026-10-23: Registrierung wird abgelehnt | Live |
| Accounts nur per Seed | `src/db/seed.ts`, `src/db/seed/supabase-user-admin.ts` (Admin-API) | `src/db/seed/supabase-user-admin.test.ts` | Test |
| Demo-Zugangsdaten nie im Repo | `.env.example` lässt `DEMO_USER_*` leer, `.env*` steht in `.gitignore` | `git ls-files` enthält nur die beiden `.env.example`. Der einzige Wert in `src/db/seed/seed-env.test.ts` ist ein Test-Platzhalter | Datei |
| `db:seed` idempotent inkl. Passwort-Reset | `src/db/seed/demo-seed.ts` | `src/db/seed/demo-seed.test.ts` (auch: E-Mail, Passwort und Beispielinhalt erscheinen nie im Log) | Test |

### Missbrauchsschutz und Kostenkontrolle

| Regel | Umsetzung | Nachweis | Status |
|---|---|---|---|
| Dateigröße 10 MB, beim Einlesen geprüft (`413`) | `src/sources/upload-options.ts` (`fileSize`, `files: 1`, `fields: 0`) | `src/sources/sources.controller.test.ts` „rejects a file over the size limit with 413 while reading“ | Test |
| 300 PDF-Seiten (`413`) | `src/sources/sources.service.ts` (`assertPdfPageLimit`) | `src/sources/sources.controller.test.ts`, `src/sources/sources.service.test.ts` | Test |
| 500.000 Zeichen eingefügter Text | Zod-Schema in `packages/shared`, niedrigeres `MAX_PASTED_TEXT_CHARS` in `src/sources/sources.service.ts` | `packages/shared/src/sources.test.ts`, `src/sources/sources.service.test.ts` | Test |
| 20 Quellen pro Notebook, 25 Notebooks pro Nutzer (Bestand) | `src/limits/limits.service.ts` | `src/limits/limits.service.test.ts` (auch: Löschen gibt Platz frei), `src/notebooks/notebooks.controller.test.ts`, `src/sources/sources.controller.test.ts` | Test |
| 100 Chat-Anfragen pro Nutzer und Stunde, 500 global pro Tag, 200 Uploads global pro Tag (Nutzung) | `src/limits/limits.service.ts`, `src/limits/usage-events.repository.ts` | `src/limits/limits.service.test.ts` (Grenzwerte, gleitendes Stundenfenster, Tageswechsel in Berlin, parallele Anfragen) | Test |
| Limits über die DB, Löschen setzt Nutzung nicht zurück | `usage_events` ohne Fremdschlüssel zu Notebooks oder Quellen, Prüfen und Schreiben in einer Transaktion mit Advisory-Lock | `src/limits/limits.service.test.ts` „does not reset the daily quota when sources are deleted“, „does not reset the limits when the chat history is deleted“; Live 2026-10-23: `usage_events` 5 → 5 nach dem Löschen | Test, Live |
| `429` mit anzeigbarer Meldung | `LimitExceededError` → `src/common/filters/error-response.ts` | `src/common/filters/error-response.test.ts`, `src/chat/chat.controller.test.ts`, `src/notebooks/notebooks.controller.test.ts` | Test |
| Body-Limit passend zum größten Eingabeformat, `413` mit verständlicher Meldung | `src/http-app.ts` (`JSON_BODY_LIMIT = '2mb'`), ausgelagert aus `main.ts` | **Neu:** `src/http-app.test.ts`: 500.000 Zeichen mit 3-Byte-Zeichen (`€`, ca. 1,5 MB) kommen durch, über 2 MB kommt `413` mit deutscher Meldung und `PAYLOAD_TOO_LARGE` | Test |
| Abbruch bricht die Anfrage an den Anbieter ab | `src/chat/chat.controller.ts` (`close` der Response), `src/llm/openai-compatible-chat.provider.ts` | `test/chat-abort.test.ts`, `src/llm/openai-compatible-chat.provider.test.ts` | Test |
| Technisches Rate-Limit pro IP | `src/app.module.ts` (`IP_THROTTLE`, globaler `ThrottlerGuard`), `trust proxy = 1` in `src/http-app.ts` | **Neu:** `test/throttler.test.ts`: Anfrage 121 innerhalb einer Minute → `429` im gemeinsamen Fehlerformat mit `Retry-After`, Guard ist global registriert. `src/http-app.test.ts` prüft `trust proxy = 1`. Getrennte Zähler pro Client-IP live gemessen (`docs/deployment.md`) | Test, Live |
| Monatliches Ausgabelimit bei Mistral | Mistral-Konsole | Devlog 2026-10-23 | Live |

### Härtung

| Regel | Umsetzung | Nachweis | Status |
|---|---|---|---|
| Helmet-Header | `src/http-app.ts` | **Neu:** `src/http-app.test.ts` (`X-Content-Type-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, kein `X-Powered-By`) | Test |
| CORS nur für die Web-Domain | `src/http-app.ts` (`origin: WEB_ORIGIN`, nur `GET`, `POST`, `PATCH`, `DELETE`) | **Neu:** `src/http-app.test.ts`. Hinweis: Bei fester Origin antwortet das Paket `cors` immer mit genau dieser Origin, auch auf Anfragen einer fremden Origin. Der Browser einer fremden Seite erkennt den Unterschied und blockiert die Antwort | Test |
| Alle Eingaben mit Zod validiert | Globale `ZodValidationPipe` (`src/common/pipes/zod-validation.pipe.ts`). Die Pipe prüft nur Parameter, die ein Schema nennen | **Neu:** `src/app.module.test.ts` prüft, dass jeder `@Body`, `@Query` und `@Param` aller Controller ein Schema nennt. Der hochgeladene Datei-Inhalt wird nach Inhalt geprüft (nächste Zeile) | Test |
| Dateityp nach Inhalt (Magic Bytes, UTF-8) | `src/sources/file-validation/detect-file-type.ts` | `src/sources/file-validation/detect-file-type.test.ts`, live 2026-10-23 (binäre `.txt` abgelehnt) | Test, Live |
| Secrets nur per Env, `.env.example` vollständig | `src/config/env.schema.ts`, `apps/api/.env.example` | `src/config/env.schema.test.ts` (Fehlermeldung nennt Namen, nie Werte) | Test |
| Interne Details erreichen nie den Client | `src/common/filters/error-response.ts` | `src/common/filters/all-exceptions.filter.test.ts`, `src/common/filters/error-response.test.ts` | Test |
| Markdown ohne rohes HTML | `apps/web/src/features/chat/answer/answer-markdown.tsx` (ohne `rehype-raw`) | Tests in `apps/web` (M4-WEB-02), nicht Teil dieses Pakets | Test (Web) |

### Prompt-Injection

| Regel | Umsetzung | Nachweis | Status |
|---|---|---|---|
| Quelltexte in markierten Datenblöcken | `src/chat/prompt/build-prompt.ts` | `src/chat/prompt/build-prompt.test.ts` (schließendes Tag im Inhalt beendet den Block nicht, Inhalt öffnet keinen eigenen Block, eingeschleuste Anweisung bleibt in ihrem Block) | Test |
| System-Prompt: Anweisungen in Quellen nie befolgen | `src/chat/prompt/system-prompt.ts` | `src/chat/prompt/build-prompt.test.ts`; live 2026-10-23: Injection in einer Quelle wirkungslos | Test, Live |
| Keine Tools für das Modell | `src/llm/openai-compatible-chat.provider.ts` sendet nur `model`, `messages`, `stream` | `src/llm/openai-compatible-chat.provider.test.ts` prüft den Request exakt, ein zusätzliches Feld wie `tools` ließe ihn fehlschlagen | Test |

### DSGVO

| Regel | Umsetzung | Nachweis | Status |
|---|---|---|---|
| EU-Verarbeitung | Supabase Frankfurt, Railway EU West, Mistral | `docs/deployment.md`, Einstellungen in den Dashboards | Live |
| Art. 17: vollständiges Löschen | Storage zuerst, dann Zeile (`src/sources/sources.service.ts`, `src/notebooks/notebooks.service.ts`), `ON DELETE CASCADE` auf `sources`, `chunks`, `messages` (Migrationen `0003`, `0005`, `0007`) | `src/sources/sources.service.test.ts`, `src/notebooks/notebooks.service.test.ts`, `src/chat/chat.service.test.ts`; live 2026-10-23 | Test, Live |
| Art. 20: Export als JSON | – | M5-API-02 und M5-WEB-02 (Welle 2) | Offen |
| Logging ohne Inhalte, Prompts, Antworten | Strukturierte Logs nur mit IDs, Status, Dauer, Anzahl und Fehlerklasse | `src/common/filters/all-exceptions.filter.test.ts`, `src/ingestion/ingestion.worker.test.ts`, `src/queue/queue.service.test.ts`, `src/health/health.controller.test.ts`, `test/auth-guard.test.ts`, `src/db/seed/demo-seed.test.ts`, `src/limits/usage-cleanup.job.test.ts`. **Neu:** `src/chat/chat.service.test.ts` „logging“: weder Frage noch Antwort, Quelltext, Quellentitel oder die Meldung eines Anbieter- oder Datenbankfehlers erscheinen im Log | Test |

---

## 2. Ergebnis des Audits

**Geprüft:** alle Repository-Methoden, alle `Logger`-Aufrufe in `src/` (ohne Tests), alle Controller und ihre Parameter, `main.ts`, `app.module.ts`, Migrationen, Fehlerfilter.

**Keine Lücke im Verhalten gefunden.** Alle Regeln waren umgesetzt. Die Lücken lagen in den Nachweisen. Geschlossen wurden:

- Helmet, CORS, Body-Limit und `trust proxy` waren in `main.ts` verdrahtet und ungetestet. Sie stehen jetzt in `src/http-app.ts` und sind in `src/http-app.test.ts` getestet.
- Der Throttler war ungetestet: `test/throttler.test.ts`.
- `user_id`-Filter waren nur per Service-Tests mit Fake-Repositories belegt, also nicht für das echte SQL: `test/tenant-isolation.test.ts`.
- „Nur `/health` ist öffentlich“ und „jede Eingabe hat ein Schema“ waren nicht zentral geprüft: `src/app.module.test.ts`.
- RLS war nur live geprüft: `src/db/rls.test.ts`.
- Chat-Logs waren nicht auf Inhalte geprüft: `src/chat/chat.service.test.ts`.

**Bewusst so belassen:**

- `main.ts` loggt bei einem Startfehler den Stacktrace. Beim Start gibt es noch keine Nutzerdaten, und ohne Stacktrace wäre ein fehlgeschlagener Start auf Railway nicht zu analysieren. Fehlerhafte Umgebungsvariablen nennt `EnvValidationError` nur mit Namen.
- Das Seed-Skript loggt im Fehlerfall `name` und `message` des Fehlers. Es läuft nur lokal beim Betreiber, nie auf dem Server.
- Bestandslimits können bei parallelen Anfragen genau an der Grenze um eins überschritten werden (dokumentiert in `src/limits/limits.service.ts`). Nutzungslimits sind dagegen per Advisory-Lock streng.

---

## 3. Offene Punkte

### 3.1 Herunterfahren: `SIGTERM` und pg-boss

**Ziel:** Beim Redeploy stoppt pg-boss sauber. Laufende Ingestion-Jobs beenden ihre Schreibvorgänge oder werden als fehlgeschlagen markiert und wiederholt.

**Im Code jetzt umgesetzt:**

- `src/queue/queue.service.ts` loggt `Stopping pg-boss` mit dem Signal und danach `pg-boss stopped` mit der Dauer. `boss.stop()` wartet bis zu 10 s auf laufende Jobs, danach schließt `DbModule` den Pool (bis zu 5 s). Test: `src/queue/queue.service.test.ts`.
- `src/main.ts` beendet den Prozess nach den Shutdown-Hooks mit `process.exit(0)` (`useProcessExit`). Ohne diese Option sendet Nest das Signal nach den Hooks erneut an den eigenen Prozess. Läuft Node als PID 1, ignoriert der Kernel dieses Signal, und der Prozess bliebe hängen, bis Railway ihn mit `SIGKILL` beendet.

**Nicht belegt: Erreicht das Signal den Node-Prozess?** Aus dem Repository lässt sich das nicht beweisen, und lokal fehlt eine Linux-Umgebung. Die Startkette auf Railway ist `Shell (&&) → pnpm → Shell des Skripts → node`. Dagegen spricht:

- Eine Shell, die eine `&&`-Liste ausführt, wartet auf das Kindprogramm und reicht `SIGTERM` nicht weiter. Ist die Shell PID 1 im Container, ignoriert sie `SIGTERM` sogar ganz.
- pnpm 12.14.0 unter Corepack (lokal untersucht, `bin/pnpm.mjs`) startet das native pnpm-Binary per `spawnSync` und registriert nur einen Handler für `SIGINT`. Ein `SIGTERM` beendet den Wrapper, ohne es weiterzugeben. Railpack installiert pnpm laut seiner Doku über Mise. Ob das native Binary Signale an das Skript weitergibt, ist nicht dokumentiert.
- Railway sendet nach `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` ein `SIGKILL`. Den Standardwert nennt die [Railway-Doku](https://docs.railway.com/deployments/deployment-teardown) nicht, Forenbeiträge nennen 0 oder 3 Sekunden. Das ist kürzer als der Stopp-Timeout von pg-boss (10 s).

**Empfohlene Korrektur (Dashboard, Entwickler):** pnpm nur noch für die kurze Migration nutzen und Node per `exec` an die Stelle der Shell setzen. Dann erreicht `SIGTERM` Node direkt, unabhängig von Shell und pnpm.

| Einstellung | Bisher | Neu |
|---|---|---|
| Custom Start Command | `pnpm --filter @notebooklm/api db:migrate && pnpm --filter @notebooklm/api start:prod` | `pnpm --filter @notebooklm/api db:migrate && cd apps/api && exec node dist/main` |
| Variable `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` | nicht gesetzt | `20` (10 s pg-boss, 5 s Pool, Reserve) |

`cd apps/api && exec node dist/main` entspricht dem bisherigen `start:prod`, das pnpm im Ordner `apps/api` als `node dist/main` ausführt. Eine fehlgeschlagene Migration verhindert den Start weiterhin.

**Beleg nach der Umstellung:** Abschnitt 4, Punkt „Herunterfahren“. Erst wenn beide Logzeilen im Log des alten Deployments stehen, ist der Punkt erledigt.

### 3.2 Weitere offene Punkte

- **Art. 20, Export:** folgt mit M5-API-02 und M5-WEB-02. Die Live-Prüfung steht in M5-DEP-01.
- **`docs/deployment.md`:** Die Tabelle „API auf Railway“ muss bei Übernahme der Empfehlung aus 3.1 angepasst werden. Die Datei gehört nicht zu diesem Paket.

---

## 4. Live-Checkliste für M5-DEP-01

Gegen die Produktion ausführen, nachdem `master` auf Railway und Vercel deployt ist. Platzhalter: `$API` ist die Railway-Domain, `$WEB` die Vercel-Domain, `$SUPABASE_URL` und `$ANON_KEY` die öffentlichen Werte des Prod-Projekts, `$TOKEN` ein Access-Token des Demo-Accounts (aus den Entwicklerwerkzeugen des Browsers nach dem Login). Keine Werte in Devlog, README oder Screenshots übernehmen.

### Vorbedingungen

- [ ] Railway und Vercel zeigen denselben Commit von `master`.
- [ ] Die Empfehlung aus Abschnitt 3.1 ist im Dashboard umgesetzt oder bewusst verworfen (dann im Devlog begründen).

### Authentifizierung und Mandantentrennung

- [ ] `curl -i $API/health` → `200`, `"database":"up"`.
- [ ] `curl -i $API/notebooks` → `401`. Mit `-H "Authorization: Bearer abc"` → ebenfalls `401`.
- [ ] `curl -i -H "Authorization: Bearer $TOKEN" $API/notebooks/00000000-0000-4000-8000-000000000000` → `404` mit `"code":"NOT_FOUND"`.
- [ ] `curl -i $API/gibt-es-nicht` mit Token → `404`, gleiche Antwort wie oben.
- [ ] `curl "$SUPABASE_URL/rest/v1/notebooks?select=id" -H "apikey: $ANON_KEY"` → `[]`, obwohl Notebooks existieren (RLS).
- [ ] Registrierung über `$SUPABASE_URL/auth/v1/signup` mit dem Anon-Key wird abgelehnt.
- [ ] Ein Storage-Objekt ist über die öffentliche URL (`/storage/v1/object/public/sources/...`) nicht abrufbar.

### Härtung

- [ ] `curl -I $API/health` zeigt `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy` und kein `X-Powered-By`.
- [ ] `curl -i -X OPTIONS $API/notebooks -H "Origin: https://example.com" -H "Access-Control-Request-Method: GET"` → `Access-Control-Allow-Origin` ist `$WEB`, nicht `https://example.com`.
- [ ] Antworten tragen `X-Request-Id`.

### Limits

- [ ] JSON über 2 MB an `POST $API/notebooks/<id>/sources/text` → `413` mit deutscher Meldung (z. B. Datei mit `head -c 2200000 /dev/zero | tr '\0' 'a'` als Feld `text`).
- [ ] Datei über 10 MB per curl an `POST $API/notebooks/<id>/sources/upload` → `413`.
- [ ] Technisches Rate-Limit: `for i in $(seq 1 260); do curl -s -o /dev/null -w "%{http_code}\n" $API/health; done | sort | uniq -c` zeigt `429`. Wegen der zwei Zähler pro Client (`docs/deployment.md`) kann das Limit effektiv bis 240 pro Minute liegen. Danach eine Minute warten, bevor weiter getestet wird.
- [ ] Chat-Stundenlimit: siehe M5-DEP-01 (lokal mit `CHAT_LIMIT_PER_USER_PER_HOUR=2`), die Meldung ist verständlich.
- [ ] Nutzungslimits bleiben nach dem Löschen bestehen: Anzahl in `usage_events` vor und nach dem Löschen einer Quelle ist gleich (lesende SQL-Abfrage, nur Anzahlen).

### Logs und Datenschutz

- [ ] Eine Frage mit einem eindeutigen Markerwort stellen (z. B. `Prüfwort-<Datum>`). In den Railway-Logs liefert die Suche nach dem Markerwort keinen Treffer.
- [ ] Eine Quelle mit Markerwort einfügen. Auch dieses Wort steht nicht in den Logs.
- [ ] Logzeilen enthalten nur IDs, Status, Dauer, Anzahlen und Fehlerklassen.

### Herunterfahren

- [ ] Ein Redeploy auslösen. Im Log des **alten** Deployments stehen nacheinander `Stopping pg-boss` mit `"signal":"SIGTERM"` und `pg-boss stopped` mit `durationMs`.
- [ ] Das alte Deployment endet ohne „Crashed“-Status oder Fehler-Exit-Code.
- [ ] Fehlen die Logzeilen: Startbefehl und `RAILWAY_DEPLOYMENT_DRAINING_SECONDS` prüfen (Abschnitt 3.1) und den Befund im Devlog festhalten.

### Kosten und Zugangsdaten

- [ ] In der Mistral-Konsole ist das monatliche Ausgabelimit gesetzt.
- [ ] Die Login-Seite und das ausgelieferte Web-Bundle enthalten keine Demo-Zugangsdaten (Suche nach der Demo-E-Mail im Quelltext der Seite).
