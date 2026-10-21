# apps/api – NestJS-Backend

Ergänzt die Root-[`CLAUDE.md`](../../CLAUDE.md). Die dortigen Regeln zu Sicherheit, Limits, Konventionen und Arbeitsweise gelten hier vollständig.

Das Backend ist die **einzige** Komponente, die Datenbank, Storage und KI-Anbieter anspricht. Es stellt eine REST-API mit Server-Sent Events für den Chat bereit und verarbeitet Quellen asynchron über pg-boss.

---

## Struktur

```
apps/api/
├── src/
│   ├── main.ts                  # Bootstrap: Helmet, CORS, globale Pipes/Filter/Guards
│   ├── app.module.ts            # Lädt Module abhängig von RUN_MODE
│   ├── config/                  # Env-Schema (Zod), typisierter ConfigService
│   ├── common/                  # Guards, Filter, Pipes, Decorators (z. B. @CurrentUser)
│   ├── db/
│   │   ├── schema.ts            # Drizzle-Schema (Single Source of Truth der Tabellen)
│   │   ├── migrations/          # Von drizzle-kit erzeugt, nie von Hand ändern
│   │   ├── db.module.ts
│   │   └── seed.ts              # Demo-Account und Demo-Notebook (idempotent)
│   ├── auth/                    # JWT-Prüfung gegen Supabase
│   ├── limits/                  # Zentrale Prüfung aller fachlichen Limits
│   ├── notebooks/
│   ├── sources/                 # Upload, Liste, Aktivieren/Deaktivieren, Löschen
│   ├── ingestion/               # pg-boss-Worker: Extraktion, Chunking, Embedding
│   ├── retrieval/               # Vektorsuche
│   ├── chat/                    # Prompt-Aufbau, Streaming, Zitat-Zuordnung, Verlauf
│   ├── llm/                     # Provider-Schicht (Chat + Embeddings)
│   ├── storage/                 # Supabase-Storage-Zugriff
│   ├── account/                 # Datenexport
│   └── health/
└── test/                        # Tests für Guard, Ownership und Services
```

Jedes Fachmodul folgt dem Schichtenmodell:

```
Controller  →  Service  →  Repository (Drizzle)
   HTTP         Logik        Datenzugriff
```

- **Controller** sind dünn: Routing, Validierung über die Zod-Pipe, Aufruf des Service. Keine Geschäftslogik.
- **Services** enthalten die Logik und sind ohne HTTP-Kontext testbar.
- **Repositories** kapseln alle Drizzle-Abfragen. Jede Methode bekommt die `userId` als Pflichtparameter und filtert danach. So ist die Mandantentrennung an genau einer Stelle durchgesetzt.

Für Entwickler mit Spring-Hintergrund: Module entsprechen `@Configuration`-Einheiten, Provider entsprechen `@Service`/`@Component`, Guards entsprechen Filtern in Spring Security, Pipes übernehmen die Rolle von Bean Validation.

---

## Konventionen

### Validierung

- Request- und Response-Schemas kommen aus `packages/shared` (Zod).
- Eine globale `ZodValidationPipe` validiert Body, Query und Params. Fehler werden als `400` mit Feldangaben zurückgegeben.
- Keine `class-validator`-DTOs. Ein Validierungsweg im ganzen Repo.

### Fehlerbehandlung

- Fachliche Fehler erben von `DomainError` (`common/errors/`), z. B. `NotFoundError` oder `LimitExceededError`. Ein globaler Exception-Filter übersetzt sie in einheitliche HTTP-Antworten nach `ErrorResponseSchema` aus `packages/shared`:
  ```json
  {
    "statusCode": 404,
    "error": "NotFound",
    "message": "Die angeforderte Ressource wurde nicht gefunden.",
    "code": "NOT_FOUND"
  }
  ```
- `error` ist der englische Statusname, `message` ist immer deutscher, anzeigbarer Text (PE-23). Das optionale Feld `code` (`ErrorCode`) erlaubt dem Frontend die Unterscheidung ohne Textvergleich (PE-31).
- Jede Antwort trägt den Header `X-Request-Id`. Ein gültiger eingehender Header wird übernommen, sonst erzeugt die API eine ID. Das Frontend kann sie bei Fehlern anzeigen (CORS gibt den Header frei).
- Überschrittene Limits ergeben `429` mit einer Meldung, die das Frontend direkt anzeigen kann.
- Interne Details (Stacktraces, SQL, Anbieter-Antworten) erreichen nie den Client.
- Fremde oder nicht existierende Ressourcen ergeben einheitlich `404`.

### Konfiguration

- Alle Umgebungsvariablen werden beim Start mit einem Zod-Schema validiert. Fehlt eine Pflichtvariable, startet die App nicht.
- Zugriff nur über den typisierten `ConfigService`, nie direkt über `process.env`.

| Variable | Zweck |
|---|---|
| `PORT` | Port der API (lokal 4000, auf Railway fest `8080`, siehe `docs/deployment.md`) |
| `RUN_MODE` | `all` (Standard), `api` oder `worker`, siehe Abschnitt 9 der Root-Datei |
| `DATABASE_URL` | Postgres-Verbindung über den **Session-Pooler, Port 5432** |
| `SUPABASE_URL` | Projekt-URL, für JWKS und Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage- und Admin-Zugriff, **nur im Backend** |
| `WEB_ORIGIN` | Erlaubte CORS-Origin |
| `MISTRAL_API_KEY` | Chat und Embeddings |
| `CHAT_MODELS` | Erlaubte Chat-Modelle für den Picker, das erste ist der Standard (Standard: `mistral-small-latest,ministral-8b-latest`) |
| `OLLAMA_BASE_URL` | Optional, aktiviert lokale Modelle |
| `OLLAMA_CHAT_MODELS` | Optional, lokale Chat-Modelle für den Picker |
| `MAX_FILE_SIZE_MB`, `MAX_PDF_PAGES`, `MAX_PASTED_TEXT_CHARS`, `MAX_SOURCES_PER_NOTEBOOK`, `MAX_NOTEBOOKS_PER_USER` | Upload- und Bestandslimits |
| `CHAT_LIMIT_PER_USER_PER_HOUR`, `GLOBAL_CHAT_LIMIT_PER_DAY`, `GLOBAL_UPLOAD_LIMIT_PER_DAY` | Nutzungslimits |
| `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` | Nur für das Seed-Skript |

Die Standardwerte der Limits stehen in der Root-Datei, Abschnitt 7. Neue Variablen werden sofort in `apps/api/.env.example` dokumentiert.

### Logging

- NestJS-Logger mit strukturierten Feldern (`requestId`, `sourceId`, `jobId`, `durationMs`), PE-29.
- Fehler loggt der Exception-Filter nur mit Fehlerklasse, Status und `requestId`, nie mit Meldung oder Stacktrace, weil diese Nutzerinhalte oder SQL enthalten können.
- **Nie** Dokumentinhalte, Prompts, Antworten oder Tokens loggen (DSGVO).

---

## Modul-Details

### auth

- Globaler `JwtAuthGuard` prüft das Bearer-Token gegen die JWKS des Supabase-Projekts (Signatur, Ablauf, Audience). Das Projekt nutzt asymmetrische JWT-Signaturschlüssel.
- Ausnahmen nur per `@Public()`-Decorator (aktuell nur `GET /health`).
- `@CurrentUser()` liefert die `userId` aus dem Token. Die `userId` kommt **nie** aus Body oder Query.

### limits

- Ein `LimitsService` bündelt alle fachlichen Limits. Services rufen ihn vor der Aktion auf, z. B. `assertCanUpload(userId, notebookId)` oder `assertCanChat(userId)`.
- Gezählt wird **in der Datenbank**, damit die Limits instanzübergreifend korrekt sind:
  - **Bestandslimits:** vorhandene Notebooks pro Nutzer und Quellen pro Notebook.
  - **Nutzungslimits:** Einträge in `usage_events` – Chat-Anfragen der letzten Stunde pro Nutzer, Chat-Anfragen und Uploads des laufenden Tags global.
- Ein Nutzungsereignis wird geschrieben, **sobald die Aktion angenommen ist**, also vor dem Modellaufruf bzw. vor dem Einreihen des Ingestion-Jobs. Prüfen und Schreiben laufen in einer Transaktion, damit parallele Anfragen das Limit nicht gemeinsam überschreiten.
- Ein täglicher pg-boss-Job löscht `usage_events` älter als 7 Tage.
- Zusätzlich drosselt `@nestjs/throttler` global pro IP (In-Memory, Schutz vor Anfragefluten).

### Body-Limits

- JSON-Body: **2 MB**. Das deckt 500.000 Zeichen eingefügten Text auch mit Umlauten und Sonderzeichen ab. Das Standardlimit von Express (100 KB) würde eingefügte Texte mit einem unverständlichen `413` abweisen.
- Multipart-Uploads: `MAX_FILE_SIZE_MB` über die Upload-Konfiguration, geprüft beim Einlesen, nicht erst danach.
- Zu große Anfragen ergeben `413` mit einer verständlichen Meldung über den globalen Exception-Filter.

### sources und ingestion

- Upload als `multipart/form-data` mit genau einer Datei im Feld `file` und ohne weitere Felder. Die Größe wird beim Einlesen begrenzt (`413`). Der Titel ist der Dateiname ohne Pfadanteile, gekürzt auf 200 Zeichen.
- **Typprüfung nach Inhalt:** PDF anhand der Magic Bytes (`%PDF-`), Text und Markdown durch strikte UTF-8-Dekodierung. Bei PDFs wird die Seitenzahl gegen `MAX_PDF_PAGES` geprüft (`413`).
- Ablauf (PE-16): Notebook-Ownership → Typ und Seiten → Limits prüfen und Nutzungsereignis schreiben → Datei in Storage (`{userId}/{sourceId}`) → Quelle mit Status `pending` → pg-boss-Job `ingest-source` (ab M3). Eine abgelehnte Datei verbraucht so kein Tageskontingent. Scheitert das Anlegen der Zeile, wird die Datei wieder entfernt.
- **Eingefügter Text** durchläuft denselben Weg: Er wird als UTF-8-Datei unter demselben Pfadschema `{userId}/{sourceId}` in Storage abgelegt. So gibt es einen einzigen Extraktionsweg für alle Quellen, und Löschen entfernt immer genau eine Datei. `storage_path` bleibt bei eingefügtem Text leer, der Speicherort ergibt sich aus dem Pfadschema. Die Länge prüft das Zod-Schema gegen den Standard von 500.000 Zeichen, ein niedrigeres `MAX_PASTED_TEXT_CHARS` der Service.
- Der Worker setzt den Status auf `processing` und arbeitet dann diese Schritte ab:
  1. Text seitenweise extrahieren.
  2. Absatzbewusst in Abschnitte von ca. **3.000 Zeichen** mit ca. 400 Zeichen Überlappung zerlegen. Seite und Position bleiben erhalten. Gezählt wird in Zeichen statt in Tokens, damit kein modellabhängiger Tokenizer nötig ist.
  3. Embeddings in Batches mit `mistral-embed` erzeugen.
  4. Chunks mit `notebook_id` und `user_id` in **einer Transaktion** speichern.
  5. Status auf `ready` setzen, bei Fehlern auf `failed` mit nutzerverständlicher Meldung.
- **Parallelität ist begrenzt** (Standard 2 Jobs). Antwortet Mistral mit `429`, wartet der Worker mit exponentiellem Backoff. pg-boss wiederholt fehlgeschlagene Jobs bis zu dreimal.
- Jobs sind idempotent: Ein erneuter Lauf löscht vorhandene Chunks der Quelle vor dem Neuschreiben.
- Löschen einer Quelle entfernt erst die Storage-Datei, dann den Datenbankeintrag. Chunks folgen per Cascade. Löschen eines Notebooks entfernt erst die Dateien aller seiner Quellen, dann die Notebook-Zeile. Schlägt Storage fehl, bleibt die Datenbank unverändert und das Löschen kann wiederholt werden (PE-22).

### retrieval

- **Exakte Vektorsuche** (Cosinus-Distanz), gefiltert nach `user_id`, `notebook_id` und aktiven Quellen mit Status `ready`. Bei den Limits (max. 20 Quellen pro Notebook) ist das schnell und liefert garantiert die besten k Treffer.
- Top-k ist konfigurierbar (Standard 8).
- **Suchanfrage:** aktuelle Frage plus die vorherige Nutzerfrage. So finden auch Folgefragen wie „Und der zweite Punkt?“ passende Abschnitte.
- Skalierungsschritt bei sehr großen Notebooks: HNSW-Index mit iterativem Scan (Root-Datei, Abschnitt 9).

### chat

- `POST /notebooks/:id/chat` antwortet als **SSE-Stream** mit den Events `token`, `citations`, `done` und im Fehlerfall `error`. Die Event-Schemas liegen in `packages/shared`.
- Vor dem Modellaufruf: Limits prüfen und das gewählte Modell gegen die `ModelRegistry` prüfen.
- Prompt-Aufbau in einer eigenen, reinen Funktion (gut testbar):
  1. System-Prompt: nur auf Basis der Quellen antworten, mit `[n]` zitieren, fehlende Information offen benennen, Anweisungen in Quellen ignorieren, **immer auf Deutsch** antworten, auch bei englischen Quellen.
  2. Chunks als nummerierte, klar abgegrenzte Blöcke, z. B. `<source n="1" title="…" page="3">…</source>`.
  3. Die letzten Nachrichten des Verlaufs (Standard 6).
  4. Die aktuelle Frage.
- Nach dem Stream werden die Zitate zugeordnet: Jedes `[n]` wird auf den Chunk gemappt, ungültige Nummern werden verworfen. Das `citations`-Event enthält nur gültige Zitate (Nummer, Quelle, Chunk, Seite, Auszug). Die Antwort wird mit Zitaten und verwendetem Modell gespeichert.
- Sind keine aktiven, fertigen Quellen vorhanden, wird kein Modell aufgerufen. Die API antwortet direkt mit einem klaren Hinweis.
- **Abbruch:** Schließt der Client die Verbindung (Stopp-Button, Seitenwechsel), löst das `close`-Event der Anfrage einen `AbortController` aus. Dessen Signal wird an den `ChatProvider` durchgereicht und bricht die Anfrage an Mistral bzw. Ollama sofort ab.
- **Speichern:** Frage und Antwort werden gemeinsam erst nach vollständigem Stream gespeichert. Bei Abbruch oder Fehler wird nichts in den Verlauf geschrieben. Das Nutzungsereignis bleibt bestehen, weil die Anfrage bereits Kosten verursacht hat.

### llm

- Schnittstellen `ChatProvider` (gestreamte Completion, nimmt ein `AbortSignal` entgegen) und `EmbeddingProvider` (Batch-Embedding).
- Eine Implementierung für **OpenAI-kompatible APIs** deckt Mistral und Ollama ab. Konfiguriert werden nur Base-URL, API-Key und Modellname.
- Eine `ModelRegistry` liefert die erlaubten Chat-Modelle aus der Konfiguration. Der Chat-Endpunkt akzeptiert nur Modelle aus dieser Liste. Ohne Angabe wird das erste, günstigste Modell verwendet.
- Fachmodule hängen nur von den Schnittstellen ab. In Tests werden Fake-Provider injiziert.

### account

- `GET /me/export` liefert alle Notebooks, Quellen-Metadaten und Nachrichten des Nutzers als JSON-Download.
- Es gibt keinen Endpunkt zur Account-Löschung. Accounts verwaltet der Betreiber (Root-Datei, Abschnitt 7).

### seed

- `db:seed` legt den Demo-Account über die Supabase-Admin-API an, da die Registrierung abgeschaltet ist.
- Das Skript ist idempotent: Es sucht den Demo-Nutzer per E-Mail und verwendet ihn wieder, sonst legt es ihn bestätigt an. Es setzt das Passwort auf `DEMO_USER_PASSWORD` zurück, löscht alle Notebooks des Demo-Accounts und legt das leere Notebook „Demo: Einführung“ neu an, beides in einer Transaktion.
- **Beispielquelle ab M3 (PE-17):** Ab M3 löscht das Skript auch die Storage-Dateien und legt eine Beispielquelle an (selbst verfasster Markdown-Text), die die normale Ingestion durchläuft. In M1 und M2 bleibt das Demo-Notebook leer.
- **Umgebung:** Das Skript validiert nur die Variablen, die es braucht (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_USER_*`). `db:seed` füllt fehlende Variablen aus `apps/api/.env`. `db:seed:prod` startet mit `--env-file=.env.production`; dann wird `apps/api/.env` nie gelesen, und eine fehlende Variable bricht den Seed mit ihrem Namen ab, ohne Werte.
- Zu Beginn loggt das Skript den Host der Ziel-Datenbank und die öffentliche Supabase-Projekt-URL, damit sichtbar ist, ob dev oder prod betroffen ist. Gehören Datenbank und Supabase-URL zu verschiedenen Projekten, bricht es ab. E-Mail, Passwort und Schlüssel werden nie geloggt, nur IDs und Anzahlen.

### health

- `GET /health` ist öffentlich und prüft die Datenbankverbindung. Railway nutzt ihn als Health-Check.

---

## RUN_MODE

`app.module.ts` lädt die Module abhängig von `RUN_MODE`:

| Modus | HTTP-Controller | pg-boss-Worker |
|---|---|---|
| `all` | ja | ja |
| `api` | ja | nein (Jobs werden nur eingereiht) |
| `worker` | nur `/health` | ja |

Die Demo läuft mit `all`. Die Trennung kostet jetzt nur diese Weiche und erlaubt später getrennte Services ohne Codeänderung.

---

## Datenbank

- Das Drizzle-Schema in `src/db/schema.ts` ist die einzige Quelle der Tabellendefinitionen.
- Migrationen werden mit `pnpm --filter api db:generate` erzeugt und vor dem Anwenden gelesen. Generierte Migrationen werden nicht von Hand geändert. Ausnahmen (`CREATE EXTENSION vector`, Aktivierung von RLS) stehen in einer eigenen, kommentierten SQL-Migration.
- Jede neue Tabelle bekommt `user_id`, `ON DELETE CASCADE` auf den Elternschlüssel, aktiviertes RLS und Indizes auf den Spalten, nach denen gefiltert wird (mindestens `user_id`, bei `chunks` zusätzlich `notebook_id`).
- `notebooks.user_id` verweist auf `auth.users(id)` mit `ON DELETE CASCADE`. Löscht der Betreiber einen Account, verschwinden dessen Notebooks samt allem, was daran hängt. Storage-Dateien erfasst die Kaskade nicht. `auth.users` ist in `schema.ts` nur als Ziel des Fremdschlüssels deklariert und wird nicht exportiert, damit drizzle-kit die Tabelle nie anlegt oder ändert. Folge für Tests und Skripte, die direkt in die Datenbank schreiben: Sie brauchen einen echten Nutzer.
- Ausnahme `usage_events`: kein Fremdschlüssel zu `notebooks` oder `sources`, damit Löschen die Nutzungslimits nicht zurücksetzt. `user_id` ist nullable und verweist auf `auth.users` mit `ON DELETE SET NULL`, damit nach dem Löschen eines Accounts keine Nutzer-ID zurückbleibt (`CLAUDE.md` §4). Index auf `(kind, created_at)` und `(user_id, kind, created_at)` für die Limit-Abfragen. RLS ist auch hier aktiviert.
- pg-boss legt sein eigenes Schema `pgboss` an. Es wird nicht über Drizzle verwaltet.

---

## Tests

- **Unit (Vitest):** Chunking, Prompt-Aufbau, Zitat-Zuordnung, Dateityp-Prüfung, Limit-Logik (inklusive: Löschen setzt Nutzungslimits nicht zurück), Modell-Whitelist.
- **Abbruch:** Ein abgebrochener Stream reicht das Abbruchsignal an den Fake-Provider weiter und speichert keine Nachricht.
- **Guard und Ownership (einmal zentral):** ohne oder mit ungültigem Token → `401`, fremde Ressource → `404`.
- **Services:** mit gefakten Repositories und Fake-Providern, ohne echte Datenbank.
- Keine echten Aufrufe an Mistral oder Ollama in Tests.
