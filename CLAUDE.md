# NotebookLM-Klon

Diese Datei gibt Claude Code den vollständigen Kontext zu diesem Projekt: Ziel, Umfang, Architektur, Tech-Stack, Meilensteine, Konventionen und Arbeitsweise. Sie ist die verbindliche Referenz für alle Änderungen im Repository.

Ergänzende Dokumente:

- [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) – Frontend (Next.js)
- [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) – Backend (NestJS)
- [`docs/deployment.md`](docs/deployment.md) – Umgebungen, Einrichtung und Deployment

Diese Datei beschreibt das Gesamtbild. Implementierungsdetails stehen nur in den verlinkten Dokumenten, damit nichts doppelt gepflegt wird. Widersprechen sich Code und Dokumentation, wird nachgefragt, statt still eine Seite anzupassen.

---

## 1. Kontext und Ziel

Dieses Projekt ist eine **Bewerbungsaufgabe**: ein Nachbau von [Google NotebookLM](https://notebooklm.google.com), umgesetzt innerhalb von etwa einer Woche **neben einer Vollzeitstelle**, ausdrücklich unter Einsatz von KI-Werkzeugen.

**Abgegeben werden:**

1. der Link zum GitHub-Repository,
2. ein Live-Deployment,
3. ein Loom-Video (max. 10 Minuten), das das Vorgehen erklärt und den Klon live testet.

**Bewertet werden** neben der Funktion vor allem Codequalität, Struktur, Sicherheit, Dokumentation und das nachvollziehbare Vorgehen. Jede Änderung muss einem professionellen Code-Review standhalten.

### Produktidee

Nutzer sammeln eigene Dokumente in **Notebooks** und sprechen anschließend mit einem KI-Assistenten über genau diese Quellen.

**Kernversprechen:** Antworten stützen sich ausschließlich auf die hochgeladenen Quellen und sind mit **prüfbaren Zitaten** belegt. Geben die Quellen keine Antwort her, sagt der Assistent das klar und erfindet nichts.

**Leitprinzipien:**

- **Quellentreue vor Eloquenz:** Jede inhaltliche Aussage ist auf eine Textstelle zurückführbar.
- **Sicherheit und Datenschutz by Design:** EU-Hosting, EU-KI-Anbieter, strikte Mandantentrennung, vollständiges Löschen, Datenexport.
- **Austauschbare Modelle:** Der KI-Anbieter ist eine Konfigurationsfrage, keine Architekturfrage.
- **Machbarkeit und Kosten:** Die Zeit ist knapp, das Budget klein. Wenige Funktionen sauber statt viele halb, günstigste sinnvolle Standards. Wo vereinfacht wird, geschieht das bewusst und dokumentiert.
- **Skalierbar angelegt, nicht vorab skaliert:** Die Demo läuft als einzelner Prozess. Die Stellen, an denen später skaliert wird, sind vorbereitet und beschrieben (Abschnitt 9).

---

## 2. Umfang

### Kern (Pflicht)

| Funktion | Beschreibung |
|---|---|
| Login | Anmeldung per E-Mail und Passwort (Supabase Auth). **Keine Registrierung:** Accounts werden per Seed-Skript angelegt. Die Prüfer erhalten die Zugangsdaten eines Demo-Accounts mit vorbefülltem Notebook. |
| Notebooks | Anlegen, umbenennen, löschen, auflisten. |
| Quellen | Hochladen von **PDF**, **TXT/Markdown** und **eingefügtem Text**. Asynchrone Verarbeitung mit sichtbarem Status. Einzelne Quellen für den Chat aktivieren oder deaktivieren. |
| Chat | Fragen zu den aktiven Quellen eines Notebooks. Gestreamte Antworten **auf Deutsch** mit nummerierten Zitaten. Verlauf wird pro Notebook gespeichert und kann gelöscht werden. |
| Zitate | Marker wie `[1]` in der Antwort. Hover zeigt die Textstelle, Klick öffnet ein **Seitenpanel mit dem zitierten Abschnitt**, Quellentitel und Seitenzahl. Kein eingebetteter PDF-Viewer. |
| Modellwahl | Modell-Picker im Chat (Mistral-Modelle live, Ollama-Modelle lokal). |
| Datenschutz | Löschen von Quelle, Notebook und Chatverlauf inklusive aller Dateien und Vektoren. Export aller eigenen Daten als JSON. |

### Optional (nur wenn Zeit bleibt)

- **Spracheingabe:** Fragen per Mikrofon diktieren. Die Technik wird erst bei Umsetzung per ADR entschieden.

### Bewusst nicht im Umfang

- Registrierung, E-Mail-Versand (Bestätigung, Passwort-Reset) und Account-Löschung durch den Nutzer. Accounts verwaltet der Betreiber.
- Antworten in anderen Sprachen als Deutsch.
- Studio-Funktionen (Zusammenfassungen, FAQ, Study Guide, Audio-Overview). Das Layout hat deshalb **zwei Spalten**: Quellen und Chat.
- Webseiten als Quelle (URL-Import).
- Mobile Optimierung. Die App ist für Desktop ausgelegt.
- CI-Pipeline.
- Teams, geteilte Notebooks, Rollen.

Jede dieser Vereinfachungen ist in ADR 4 begründet (Abschnitt 13). Neue Funktionen außerhalb dieser Liste werden nicht ohne Rückfrage begonnen.

---

## 3. Tech-Stack

Der Stack entspricht dem des Arbeitgebers: **Next.js, TypeScript, NestJS, Supabase**.

| Bereich | Technologie | Begründung (Kurzform) |
|---|---|---|
| Sprache | **TypeScript** (strict) überall | Durchgehende Typsicherheit von UI bis Datenbank |
| Monorepo | **pnpm Workspaces** | Gemeinsame Typen ohne zusätzliches Build-Tooling |
| Geteiltes Paket | **tsup** (Build von `packages/shared` als ESM + CJS) | Vermeidet ESM/CommonJS-Konflikte zwischen Next.js und NestJS |
| Frontend | **Next.js** (App Router), React | Arbeitgeber-Stack, Server Components |
| UI | **Tailwind CSS**, **shadcn/ui**, lucide-react | Konsistentes, zugängliches Design-System |
| Server-State im Client | **TanStack Query** | Caching, Ladezustände, Invalidierung |
| Backend | **NestJS** | Arbeitgeber-Stack, modulare Architektur mit Dependency Injection |
| Datenbank | **Supabase Postgres** mit **pgvector** (Region Frankfurt) | Relationale Daten und Vektorsuche in einer Datenbank |
| ORM | **Drizzle ORM** + drizzle-kit | Native pgvector-Unterstützung, SQL-nah, typsicher |
| Job-Queue | **pg-boss** | Queue direkt in Postgres, kein zusätzlicher Dienst |
| Dateien | **Supabase Storage** (privater Bucket) | Gleiche Plattform, EU-Region |
| Auth | **Supabase Auth** (nur Login) | JWT-Prüfung im Backend, keine eigene Passwortverwaltung |
| Validierung | **Zod** (geteilt in `packages/shared`) | Eine Quelle der Wahrheit für API-Verträge |
| LLM (live) | **Mistral AI** (EU) | DSGVO-freundlich, günstig, OpenAI-kompatible API |
| LLM (lokal) | **Ollama** | Lokale Modelle ohne Datenabfluss und ohne Kosten |
| Embeddings | **mistral-embed** (1024 Dimensionen) | Fest für alle Umgebungen, siehe Abschnitt 6 |
| Tests | **Vitest** (Web und API), **Playwright** (E2E) | Ein Test-Runner für das ganze Repo |
| Code-Qualität | ESLint, Prettier, `tsc --noEmit` | Einheitlicher Stil, keine Typfehler |
| Deployment | **Vercel** (Web), **Railway** (API, EU-Region), **Supabase Cloud** | Einfach, günstig, EU-Standorte |

Exakte Versionen stehen in den jeweiligen `package.json`. Neue Abhängigkeiten werden nur mit klarem Mehrwert hinzugefügt und vorher angesprochen.

---

## 4. Architektur

```
┌──────────────────────────┐        HTTPS (REST + SSE)        ┌───────────────────────────────┐
│  apps/web  (Next.js)     │  Bearer-Token (Supabase-JWT)     │  apps/api  (NestJS)           │
│  Vercel                  │ ───────────────────────────────► │  Railway (EU)                 │
│                          │ ◄─────────────────────────────── │                               │
│  Login via Supabase Auth │                                  │  Auth-Guard (JWT-Prüfung)     │
└────────────┬─────────────┘                                  │  Notebooks · Sources · Chat   │
             │ nur Login                                      │  Ingestion-Worker (pg-boss)   │
             ▼                                                │  LLM-Provider-Schicht         │
┌──────────────────────────┐                                  └──────┬───────────────┬────────┘
│  Supabase (Frankfurt)    │ ◄──────── Drizzle / Storage ────────────┘               │
│  Auth · Postgres +       │                                                         ▼
│  pgvector · Storage      │                                          ┌──────────────────────────┐
└──────────────────────────┘                                          │ Mistral API (EU) / Ollama│
                                                                      └──────────────────────────┘
```

**Grundregeln:**

- Das Frontend nutzt Supabase **ausschließlich für den Login**. Alle Daten laufen über die NestJS-API.
- Der Browser ruft die API direkt auf (CORS nur für die eigene Web-Domain). So entfallen Timeouts von Vercel-Funktionen beim Streaming.
- Die API ist die einzige Stelle, die Datenbank, Storage und KI-Anbieter anspricht.

### RAG-Ablauf (Überblick)

1. **Ingestion (asynchron):** Upload → Text extrahieren (PDF seitenweise) → in Abschnitte zerlegen → Embeddings erzeugen → speichern. Der Status der Quelle ist in der UI sichtbar: `pending`, `processing`, `ready`, `failed`.
2. **Retrieval:** Die Frage wird eingebettet und per Vektorsuche mit den Abschnitten der aktiven Quellen des Notebooks verglichen.
3. **Generierung:** Das Modell antwortet gestreamt und zitiert mit `[n]`. Das Backend ordnet jedes Zitat einem Abschnitt zu und speichert es strukturiert.

Details zu Chunking, Prompt-Aufbau und Zitat-Zuordnung stehen in [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md).

### Datenmodell (Kern)

| Tabelle | Wichtige Spalten |
|---|---|
| `notebooks` | `id`, `user_id`, `title`, `created_at`, `updated_at` |
| `sources` | `id`, `notebook_id`, `user_id`, `type` (`pdf`, `text`, `markdown`, `pasted`), `title`, `storage_path` (leer bei eingefügtem Text), `status`, `error`, `is_active`, `created_at` |
| `chunks` | `id`, `source_id`, `notebook_id`, `user_id`, `content`, `embedding vector(1024)`, `page`, `position` |
| `messages` | `id`, `notebook_id`, `user_id`, `role`, `content`, `model`, `citations jsonb`, `created_at` |
| `usage_events` | `id`, `user_id` (nullable), `kind` (`chat`, `upload`), `created_at` |

- Jede Tabelle trägt `user_id`. Fremdschlüssel sind mit `ON DELETE CASCADE` angelegt.
- `usage_events` ist die Ausnahme: ein reines Zähl-Protokoll ohne Inhalte, ohne Bezug zu Notebooks oder Quellen. Es bleibt beim Löschen von Chats und Quellen erhalten, damit Löschen keine Limits zurücksetzt. Löscht der Betreiber einen Account, wird `user_id` auf `NULL` gesetzt. Die Einträge zählen dann nur noch für die globalen Limits. Einträge älter als 7 Tage entfernt ein täglicher Aufräum-Job.
- `chunks.notebook_id` ist bewusst denormalisiert und indiziert. Die Vektorsuche filtert damit direkt, ohne Join über `sources`.

---

## 5. Repository-Struktur

```
NotebookLM_Clone/
├── CLAUDE.md                 # Diese Datei
├── README.md                 # Einstieg für die Prüfer, Gliederung siehe Abschnitt 13
├── package.json              # Workspace-Root, übergreifende Skripte
├── pnpm-workspace.yaml
├── tsconfig.base.json        # Gemeinsame, strikte TypeScript-Einstellungen
├── .gitignore                # Schließt u. a. alle .env-Dateien außer .env.example aus
├── .editorconfig
├── .nvmrc                    # Node.js-Version (LTS)
├── apps/
│   ├── web/                  # Next.js-Frontend (eigene CLAUDE.md, eigene .env.example)
│   └── api/                  # NestJS-Backend (eigene CLAUDE.md, eigene .env.example)
├── packages/
│   └── shared/               # Zod-Schemas, API-Typen, Konstanten (Limits)
└── docs/
    ├── deployment.md         # Umgebungen, Einrichtung, Deployment
    ├── adr/                  # Architecture Decision Records
    ├── devlog.md             # Entwicklungs-Log pro Tag
    └── ai-workflow.md        # Wie KI-Werkzeuge eingesetzt wurden
```

`packages/shared` enthält **nur** Typen, Zod-Schemas und Konstanten, ohne Abhängigkeiten zu Next.js oder NestJS. Es wird mit `tsup` gebaut und im Entwicklungsmodus im Watch-Modus mitgestartet. Next.js bindet es zusätzlich über `transpilePackages` ein.

---

## 6. LLM-Provider-Konzept

Alle Modelle werden über **eine OpenAI-kompatible Provider-Schnittstelle** angesprochen. Mistral und Ollama bieten beide eine solche API. Weitere Anbieter (OpenAI, OpenRouter, Gemini) lassen sich später allein per Konfiguration ergänzen, ohne Codeänderung in den Fachmodulen.

**Standardmodelle (günstigste sinnvolle Wahl):**

| Zweck | Modell | Hinweis |
|---|---|---|
| Chat, Standard | `mistral-small-latest` | Günstig und stark genug für zitierende Antworten |
| Chat, Alternative | `ministral-8b-latest` | Noch günstiger, für einfache Fragen |
| Embeddings | `mistral-embed` | Einziges Embedding-Modell, auch lokal |
| Chat, lokal | Ollama-Modelle laut Konfiguration | Nur in der Entwicklung, kostenlos |

Die aktuellen Preise werden vor dem Deployment auf der Mistral-Preisseite geprüft.

- **Chat-Modelle** sind pro Nachricht im Modell-Picker wählbar. Die Liste der erlaubten Modelle kommt aus der Konfiguration der API, das erste ist der Standard. Das Frontend darf keine beliebigen Modellnamen senden.
- **Live** sind nur Mistral-Modelle verfügbar. **Ollama** ist nur lokal aktiv, wenn `OLLAMA_BASE_URL` gesetzt ist, und wird im Picker als „Lokal“ gekennzeichnet.
- **Embeddings** nutzen immer `mistral-embed`. Alle Vektoren müssen aus demselben Modell stammen. Ein Wechsel des Embedding-Modells erfordert eine Neuindizierung und ist eine Architekturentscheidung (ADR).
- **Antwortsprache ist immer Deutsch.** Das hält Prompt, Tests und UI einfach und ist als bewusste Vereinfachung in ADR 4 festgehalten.

---

## 7. Sicherheit und Datenschutz

Sicherheit ist ein ausdrückliches Bewertungskriterium. Diese Regeln gelten ohne Ausnahme.

### Authentifizierung und Autorisierung

- Jeder API-Endpunkt außer `GET /health` erfordert ein gültiges Supabase-JWT. Ein globaler Guard prüft es.
- **Jede Datenbankabfrage filtert nach `user_id`** des angemeldeten Nutzers. Fremde Ressourcen liefern `404`, nicht `403`, um ihre Existenz nicht preiszugeben.
- **Row Level Security** ist auf allen Tabellen aktiviert, ohne Policies für die Rollen `anon` und `authenticated`. Die Daten sind damit über die öffentliche Supabase-API nicht erreichbar, selbst wenn der Anon-Key bekannt ist (Defense in Depth).
- Der Storage-Bucket ist privat. Dateipfade folgen dem Schema `{userId}/{sourceId}`.

### Login ohne Registrierung

- In Supabase ist die Registrierung neuer Nutzer **abgeschaltet**. Accounts entstehen nur über das Seed-Skript mit der Admin-API.
- Damit entfallen E-Mail-Versand, Bestätigungsprozess und das Risiko von Massenregistrierungen. In Produktion käme eine Registrierung mit E-Mail-Bestätigung über eigenen SMTP hinzu (ADR 4).

### Demo-Account

- Die Zugangsdaten stehen **nie im Repository** und nie auf der Live-Seite. Sie werden nur in der Bewerbungs-Mail an die Prüfer weitergegeben.
- `db:seed` ist idempotent: Es setzt Demo-Daten **und das Demo-Passwort** auf den Ausgangszustand zurück. Vor der Abgabe und bei Bedarf wird es erneut ausgeführt.

### Missbrauchsschutz und Kostenkontrolle

Die Demo ist öffentlich erreichbar und die KI-Kosten trägt der Entwickler. Zugangsdaten können weitergegeben werden. Deshalb gibt es Limits, die auch dann greifen. Alle Werte sind per Env-Variable anpassbar.

| Limit | Standard | Ebene |
|---|---|---|
| Dateigröße | 10 MB | pro Datei |
| PDF-Seiten | 300 | pro Datei |
| Eingefügter Text | 500.000 Zeichen | pro Quelle |
| Quellen | 20 | pro Notebook |
| Notebooks | 25 | pro Nutzer |
| Chat-Anfragen | 100 | pro Nutzer und Stunde (mehrere Prüfer teilen sich den Demo-Account) |
| Chat-Anfragen | 500 | **global** pro Tag |
| Uploads | 200 | **global** pro Tag |

- Fachliche Limits werden **über die Datenbank** gezählt. Sie gelten damit auch bei mehreren Instanzen.
  - **Bestandslimits** (Quellen pro Notebook, Notebooks pro Nutzer) zählen vorhandene Zeilen. Löschen gibt hier zu Recht Platz frei.
  - **Nutzungslimits** (Chat-Anfragen, Uploads) zählen Einträge in `usage_events`. Löschen setzt sie **nicht** zurück, sonst ließen sie sich durch Löschen und erneutes Hochladen umgehen.
- Das Body-Limit der API ist auf das größte erlaubte Eingabeformat abgestimmt. Zu große Anfragen werden vor der Verarbeitung abgewiesen.
- Bricht der Nutzer eine laufende Antwort ab, bricht die API auch die Anfrage an den KI-Anbieter ab. Es entstehen keine Kosten für Text, den niemand liest.
- Zusätzlich drosselt ein technisches Rate-Limit pro IP Anfragefluten (Abschnitt 9).
- In der Mistral-Konsole ist ein **monatliches Ausgabelimit** gesetzt. Das ist die letzte Sicherung.

### Härtung

- Helmet-Security-Header, CORS nur für die konfigurierte Web-Domain.
- Alle Eingaben werden mit Zod validiert.
- Dateitypen werden nach Inhalt geprüft, nicht nach Endung: PDFs anhand der Magic Bytes, Text und Markdown durch eine gültige UTF-8-Dekodierung.
- Secrets nur über Umgebungsvariablen. `.env`-Dateien werden nie committet. Die `.env.example` jeder App dokumentiert jede Variable.
- KI-Antworten werden als Markdown **ohne rohes HTML** gerendert (Schutz vor XSS).

### Prompt-Injection-Schutz

Nutzer laden beliebige Dokumente hoch. Diese können Anweisungen an das Modell enthalten.

- Quelltexte werden im Prompt in eindeutig markierte Blöcke gesetzt und als **Daten** deklariert.
- Das System-Prompt legt fest, dass Anweisungen innerhalb von Quellen nie befolgt werden.
- Das Modell hat keine Tools und keinen Zugriff auf andere Daten. Der Schaden einer Injection bleibt damit auf die eine Antwort begrenzt.

### DSGVO

- **EU-Verarbeitung:** Supabase in Frankfurt, Railway in der EU-Region, Mistral als EU-Anbieter.
- **Recht auf Löschung (Art. 17):** Das Löschen einer Quelle, eines Notebooks oder des Chatverlaufs entfernt Dateien, Abschnitte, Vektoren und Nachrichten vollständig. Accounts löscht in der Demo der Betreiber.
- **Datenübertragbarkeit (Art. 20):** Export aller eigenen Notebooks, Quellen-Metadaten und Chats als JSON.
- **Datensparsamkeit im Logging:** Dokumentinhalte, Prompts und Antworten werden nie geloggt. Geloggt werden nur IDs, Status, Dauer und Fehlerklassen.

---

## 8. Umgebungen und Deployment

| Umgebung | Web | API | Supabase |
|---|---|---|---|
| Entwicklung | `localhost:3000` | `localhost:4000` | Cloud-Projekt `notebooklm-dev` |
| Produktion | Vercel | Railway (EU) | Cloud-Projekt `notebooklm-prod` (Frankfurt) |

Einrichtung, Datenbankverbindung, Build-Einstellungen, Kosten und Checklisten stehen in [`docs/deployment.md`](docs/deployment.md). Was nach jedem Meilenstein live sein muss, steht in Abschnitt 10.

---

## 9. Betrieb und Skalierung

Die Demo läuft bewusst als **ein einzelner API-Prozess**, der Anfragen beantwortet und Ingestion-Jobs verarbeitet. Das ist für die Last einer Demo angemessen und hält Betrieb und Kosten minimal. Die Skalierungsschritte sind vorbereitet:

| Engpass | Heute | Skalierungsschritt |
|---|---|---|
| Ingestion blockiert API-Ressourcen | Worker im selben Prozess (`RUN_MODE=all`) | Derselbe Code als zweiter Railway-Service mit `RUN_MODE=worker`, die API mit `RUN_MODE=api`. Keine Codeänderung. |
| Technisches Rate-Limit pro IP | Im Speicher, gilt pro Instanz | Speicher-Backend auf Postgres oder Redis umstellen |
| Fachliche Limits | Über die Datenbank gezählt (`usage_events`, Bestandszahlen) | Bereits instanzübergreifend korrekt |
| Vektorsuche | Exakte Suche, gefiltert nach `notebook_id` | HNSW-Index mit iterativem Scan, sobald Notebooks sehr groß werden |
| KI-Anbieter-Limits | Begrenzte Parallelität im Worker, Backoff bei `429` | Höhere Anbieter-Stufe oder weitere Provider über die Provider-Schicht |

Die API ist zustandslos. Sitzungen stecken im JWT, Daten in Postgres und Storage. Weitere API-Instanzen lassen sich daher ohne Umbau hinzufügen.

---

## 10. Meilensteine

Gearbeitet wird in Meilensteinen, die jeweils in ein bis zwei Abende passen. **Jeder Meilenstein endet mit einem Deployment**, damit Probleme beim Deployment früh auffallen und nicht am letzten Abend. Ein Meilenstein ist erst abgeschlossen, wenn der beschriebene Live-Zustand erreicht ist und der Devlog-Eintrag steht.

| # | Meilenstein | Inhalt | Live-Zustand nach dem Deployment |
|---|---|---|---|
| M0 | Fundament | Monorepo, `packages/shared`, Lint/Typecheck/Test-Skripte, beide Supabase-Projekte, NestJS mit `GET /health`, Next.js-Grundlayout | Web zeigt eine Startseite, `GET /health` der API meldet eine funktionierende Datenbankverbindung |
| M1 | Login und Notebooks | Supabase-Login, Auth-Guard, `proxy.ts`, Seed-Skript mit Demo-Account, Notebooks anlegen/umbenennen/löschen | Login mit dem Demo-Account, Notebooks verwalten, ohne Login keine Daten erreichbar |
| M2 | Quellen | Upload (PDF, TXT/MD, eingefügter Text), Storage, Typprüfung, Upload-Limits mit `usage_events`, Quellenliste, Aktivieren/Deaktivieren, Löschen | Quellen hochladen und verwalten. Status bleibt „wartet“, weil noch keine Verarbeitung läuft |
| M3 | Ingestion | pg-boss-Worker, Textextraktion, Chunking, Embeddings, Statusanzeige mit Polling | Hochgeladene Quellen wechseln live auf „bereit“ oder „fehlgeschlagen“ |
| M4 | Chat mit Zitaten | Retrieval, Prompt, Streaming mit Abbruch, Zitat-Zuordnung, Zitat-Popover und -Seitenpanel, Modell-Picker, Verlauf, Chat-Limits | **Der Kernfluss funktioniert vollständig live.** Ab hier ist die Demo vorzeigbar |
| M5 | Feinschliff | Datenexport, alle Lade-/Leer-/Fehlerzustände, Design-Politur, Playwright-Test, Prüfung aller Limits und Sicherheitsregeln | Abgabefähiger Stand, Demo-Daten per Seed frisch |
| M6 | Abgabe | README finalisieren (Links, Screenshot), ADRs, Devlog, KI-Workflow-Doku, Checkliste aus `docs/deployment.md`, Loom-Video | Eingefroren. Nur noch Seed-Reset, keine Feature-Änderungen |
| M7 | Optional: Spracheingabe | Nur wenn M0–M6 fertig sind | Spracheingabe zusätzlich live |

**Reihenfolge ist verbindlich.** Ein Meilenstein wird erst begonnen, wenn der vorherige live ist. Läuft die Zeit knapp, wird im aktuellen Meilenstein gekürzt, nicht am Fundament oder an der Sicherheit.

---

## 11. Konventionen

### Sprache

| Was | Sprache |
|---|---|
| Code, Bezeichner, Kommentare | Englisch |
| Commit-Messages | Englisch |
| Benutzeroberfläche und KI-Antworten | **Deutsch** |
| CLAUDE.md-Dateien, README, ADRs, Devlog, weitere Doku | Deutsch |

### Code

- TypeScript `strict`, kein `any`, keine `@ts-ignore` ohne begründenden Kommentar.
- Kleine, fokussierte Funktionen und Module mit genau einer Verantwortung.
- Kommentare erklären das **Warum**, nicht das Was.
- Keine toten Codepfade, keine auskommentierten Blöcke, keine `console.log`-Reste.
- API-Verträge (Request, Response, SSE-Events) werden **einmal** als Zod-Schema in `packages/shared` definiert und auf beiden Seiten verwendet.
- Fehler werden nicht verschluckt. Sie werden behandelt oder mit Kontext weitergereicht.
- Lade-, Fehler- und Leerzustände sind Teil jeder Funktion, nicht Nacharbeit.

### Tests

Die Teststrategie ist auf die verfügbare Zeit zugeschnitten: viel Absicherung an den kritischen Stellen, keine Wiederholung.

- **Unit-Tests** für die Kernlogik: Chunking, Prompt-Aufbau, Zitat-Zuordnung, Limit-Prüfungen, Dateityp-Prüfung.
- **Sicherheitstests zentral statt pro Endpunkt:** Auth-Guard (kein oder ungültiges Token → `401`) und Ownership-Prüfung (fremde Ressource → `404`) werden einmal gründlich getestet. Alle Endpunkte nutzen dieselben Bausteine.
- **Service-Tests** mit gefakten Repositories und KI-Providern, ohne echte Datenbank.
- **Ein Playwright-E2E-Test** gegen die Entwicklungsumgebung deckt den Hauptfluss ab: Login, Notebook anlegen, Quelle einfügen, Frage stellen, Zitat sehen.
- Externe KI-APIs werden in Unit- und Service-Tests immer gemockt.
- Ein Bugfix kommt mit einem Test, der den Fehler vorher reproduziert.

### Git und Commits

- **Claude führt keine schreibenden Git-Befehle aus** (`init`, `add`, `commit`, `push`, `branch`, `merge`, `tag`, `remote` usw.). Git und GitHub verwaltet ausschließlich der Entwickler. Lesende Befehle (`status`, `diff`, `log`) sind erlaubt.
- Nach einem abgeschlossenen Arbeitsschritt schlägt Claude eine Commit-Message vor.
- Format: **Conventional Commits** mit Scope, z. B.:
  - `feat(api): add pg-boss ingestion queue`
  - `fix(web): keep citation popover inside viewport`
  - `docs(adr): record choice of drizzle over prisma`
- Erlaubte Typen: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`.

---

## 12. Befehle

Alle Befehle werden im Repository-Root ausgeführt.

```bash
pnpm install                    # Abhängigkeiten installieren
pnpm dev                        # Shared (Watch), Web und API parallel starten
pnpm build                      # Alle Pakete bauen
pnpm lint                       # ESLint in allen Paketen
pnpm format                     # Code mit Prettier formatieren (pnpm format:check prüft nur)
pnpm typecheck                  # tsc --noEmit in allen Paketen
pnpm test                       # Vitest in allen Paketen
pnpm test:e2e                   # Playwright-E2E-Test gegen die Entwicklungsumgebung
pnpm --filter api db:generate   # Drizzle-Migration aus dem Schema erzeugen
pnpm --filter api db:migrate    # Migrationen anwenden
pnpm --filter api db:seed       # Demo-Account und Demo-Notebook anlegen bzw. zurücksetzen
```

**Vor dem Abschluss jeder Aufgabe** müssen `pnpm lint`, `pnpm typecheck` und `pnpm test` fehlerfrei laufen.

---

## 13. Dokumentation des Vorgehens

Die Prüfer wollen sehen, **wie** gearbeitet wurde. Diese Dokumente werden laufend gepflegt, kurz und sachlich.

### README

Das README ist der **erste Eindruck der Prüfer**. Es existiert von Beginn an und muss immer den tatsächlichen Stand zeigen: Keine Funktion wird als vorhanden beschrieben, die nicht live funktioniert. Ändert sich Umfang, Stack oder Einrichtung, wird es im selben Schritt angepasst. In M6 werden Links und Screenshot ergänzt. Gliederung:

1. **Titel und Einzeiler:** Was das Projekt ist.
2. **Links:** Live-Demo und Loom-Video. Hinweis, dass die Zugangsdaten in der Bewerbungs-Mail stehen.
3. **Screenshot:** Notebook-Ansicht mit Quellen, Chat und geöffnetem Zitat.
4. **Funktionen:** Kurze Liste des Umfangs.
5. **Architektur:** Diagramm und RAG-Ablauf in wenigen Sätzen.
6. **Tech-Stack:** Tabelle mit Kurzbegründung.
7. **Sicherheit und Datenschutz:** Die wichtigsten Maßnahmen in Stichpunkten.
8. **Lokale Einrichtung:** Voraussetzungen, `.env`-Dateien, Befehle.
9. **Bewusste Abwägungen:** Was vereinfacht wurde und warum, mit Verweis auf ADR 4.
10. **Ausblick:** Nächste sinnvolle Schritte (Registrierung, Studio-Funktionen, Skalierung).
11. **Vorgehen und KI-Einsatz:** Verweis auf Devlog, ADRs und KI-Workflow-Doku.

### Architecture Decision Records (`docs/adr/`)

Format `NNNN-titel.md`, jeweils etwa eine halbe Seite mit Kontext, Entscheidung, Alternativen und Konsequenzen. Geplant sind vier:

1. Monorepo mit separatem NestJS-Backend und Datenzugriff nur über die API
2. Drizzle und pg-boss auf Supabase Postgres statt Prisma und Redis
3. Mistral als EU-Anbieter hinter einer OpenAI-kompatiblen Provider-Schicht, mit den günstigsten sinnvollen Standardmodellen
4. Bewusste Vereinfachungen für die Demo und ihr Weg in die Produktion:
   - nur Login, keine Registrierung, kein E-Mail-Versand, Accounts verwaltet der Betreiber
   - Antworten nur auf Deutsch
   - Chunking nach Zeichen statt nach Tokens
   - ein Prozess für API und Worker, exakte Vektorsuche
   - zwei Spalten ohne Studio-Funktionen, nur Desktop

### Devlog und KI-Workflow

- **`docs/devlog.md`** – Ein Eintrag pro Arbeitstag: Meilenstein, was umgesetzt wurde, welche Probleme auftraten, was als Nächstes kommt. Dient auch als Gerüst für das Loom-Video.
- **`docs/ai-workflow.md`** – Wie Claude Code eingesetzt wurde: Planung über diese CLAUDE.md, Umsetzung in kleinen Schritten, Review und Tests jedes Schritts, Grenzen und Korrekturen. Ehrlich, auch dort, wo die KI danebenlag.

---

## 14. Arbeitsweise für Claude

1. **Erst verstehen, dann ändern.** Betroffene Dateien lesen, bevor etwas geändert wird. Bei Unklarheiten nachfragen.
2. **Meilensteine einhalten.** Nur am aktuellen Meilenstein arbeiten (Abschnitt 10). Am Ende steht das Deployment, nicht das nächste Feature.
3. **Klein und abgeschlossen arbeiten.** Jeder Schritt ergibt einen sinnvollen, einzeln committbaren Stand, der in eine Abendsitzung passt.
4. **Einfach und günstig bleiben.** Die einfachste Lösung, die sauber und sicher ist, gewinnt. Keine vorsorglichen Abstraktionen über die in Abschnitt 9 beschriebenen Skalierungsstellen hinaus. Keine kostenpflichtigen Dienste oder teureren Modelle ohne Rückfrage.
5. **Vor dem Abschluss prüfen.** Lint, Typecheck und Tests laufen lassen. Ergebnisse ehrlich berichten, auch Fehlschläge.
6. **Keine stillen Architekturentscheidungen.** Neue Abhängigkeiten, Schemaänderungen und Abweichungen von diesen Dateien vorher ansprechen. Getroffene Entscheidungen als ADR festhalten.
7. **Dokumentation mitziehen.** Ändern sich Stack, Struktur, Befehle oder Umgebungsvariablen, werden CLAUDE.md, `docs/deployment.md` und die `.env.example` im selben Schritt angepasst. Am Ende eines Arbeitstags wird `docs/devlog.md` ergänzt.
8. **Quellentreue schützen.** Änderungen an Prompt, Retrieval oder Zitatlogik dürfen die Belegbarkeit der Antworten nie verschlechtern.
9. **Sicherheit nie abkürzen.** Die Regeln aus Abschnitt 7 gelten auch für Prototypen und Tests.
10. **Kein Git.** Siehe Abschnitt 11. Am Ende eines Schritts wird eine Commit-Message vorgeschlagen.
