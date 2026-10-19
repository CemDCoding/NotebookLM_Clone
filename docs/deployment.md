# Deployment

Dieses Dokument beschreibt Umgebungen, Einrichtung und Deployment des NotebookLM-Klons. Welcher Funktionsumfang nach jedem Meilenstein live sein muss, steht in der [`CLAUDE.md`](../CLAUDE.md), Abschnitt 10.

---

## Umgebungen

| Umgebung | Web | API | Supabase |
|---|---|---|---|
| Entwicklung | `localhost:3000` | `localhost:4000` | Cloud-Projekt `notebooklm-dev` |
| Produktion | Vercel | Railway (EU) | Cloud-Projekt `notebooklm-prod` (Frankfurt) |

- Für die Entwicklung gibt es ein **eigenes Supabase-Cloud-Projekt**. Es braucht kein Docker und verhält sich identisch zur Produktion.
- Die Projekte teilen nie Schlüssel oder Daten.
- Lokal kann zusätzlich **Ollama** für Chat-Modelle genutzt werden. Embeddings laufen auch lokal über Mistral.

---

## Kosten

Ziel ist der günstigste Betrieb, der für eine öffentliche Demo zuverlässig ist.

| Dienst | Plan | Kosten |
|---|---|---|
| Vercel | Hobby | kostenlos |
| Supabase | Free (zwei Projekte: dev und prod) | kostenlos |
| Railway | Hobby | geringe monatliche Grundgebühr mit enthaltenem Nutzungsguthaben |
| Mistral | Pay-as-you-go | nutzungsabhängig, durch monatliches Ausgabelimit gedeckelt |

Die aktuellen Preise und Limits werden vor der Einrichtung auf den Seiten der Anbieter geprüft.

---

## Einrichtung Supabase

Für **beide** Projekte:

1. Region **Frankfurt** (`eu-central-1`) wählen.
2. Extension `vector` aktivieren. Das übernimmt alternativ die erste SQL-Migration.
3. **Authentication:**
   - E-Mail/Passwort-Anmeldung aktiviert.
   - **Registrierung neuer Nutzer deaktiviert.** Accounts entstehen nur über `db:seed`.
   - Asymmetrische JWT-Signaturschlüssel aktiv. Bei neuen Projekten ist das Standard.
4. **Storage:** privaten Bucket `sources` anlegen, ohne Policies. Zugriff erfolgt nur über die API mit dem Service-Role-Key.
5. Verbindungsdaten für die API notieren: Projekt-URL, Service-Role-Key und Connection-String des **Session-Poolers**.

### Datenbankverbindung

Die API verbindet sich über den **Session-Pooler (Port 5432)**, nicht über den Transaction-Pooler (Port 6543). pg-boss und Drizzle sind auf eine dauerhafte Session angewiesen. Die API läuft auf Railway als langlebiger Prozess, das passt dazu.

---

## Lokale Entwicklung

1. `pnpm install`
2. `apps/api/.env.example` nach `apps/api/.env` kopieren und mit den Werten von `notebooklm-dev` füllen.
3. `apps/web/.env.example` nach `apps/web/.env.local` kopieren und füllen.
4. `pnpm --filter api db:migrate`
5. `pnpm --filter api db:seed`
6. `pnpm dev`

Optional für lokale Modelle: Ollama starten und `OLLAMA_BASE_URL` in `apps/api/.env` setzen. Damit Prompts mit mehreren Quellenabschnitten nicht abgeschnitten werden, wird die Kontextlänge von Ollama erhöht (`OLLAMA_CONTEXT_LENGTH`, z. B. 16384).

---

## API auf Railway

| Einstellung | Wert |
|---|---|
| Region | EU |
| Build | `pnpm install --frozen-lockfile && pnpm --filter shared build && pnpm --filter api build` |
| Start | `pnpm --filter api db:migrate && pnpm --filter api start:prod` |
| Health-Check | `GET /health` |
| `RUN_MODE` | `all` |
| `WEB_ORIGIN` | Produktionsdomain von Vercel |

Alle weiteren Variablen stehen in `apps/api/.env.example`.

Migrationen laufen vor jedem Start. Schlägt eine Migration fehl, startet die neue Version nicht und die alte bleibt aktiv.

---

## Web auf Vercel

| Einstellung | Wert |
|---|---|
| Root-Verzeichnis | `apps/web` |
| Framework | Next.js |
| Region der Funktionen | Frankfurt (`fra1`) |

Variablen laut `apps/web/.env.example`, mit `NEXT_PUBLIC_API_URL` auf die Railway-Domain.

CORS erlaubt nur die Produktionsdomain. Preview-Deployments von Vercel erreichen die API deshalb nicht. Das ist gewollt.

---

## Ablauf pro Meilenstein

Jeder Meilenstein endet mit einem Deployment:

1. Lokal: `pnpm lint`, `pnpm typecheck` und `pnpm test` grün.
2. Bei Schemaänderungen: Migration lokal gegen `notebooklm-dev` geprüft.
3. Der Entwickler committet und pusht. Railway und Vercel deployen automatisch.
4. **Smoke-Test live:** den Live-Zustand des Meilensteins aus der `CLAUDE.md` (Abschnitt 10) von Hand durchspielen.
5. Ergebnis im `docs/devlog.md` festhalten.

**Rollback:** Vercel kann eine frühere Version sofort wieder aktivieren. Railway kann ein früheres Deployment erneut ausrollen. Migrationen werden deshalb nur additiv geschrieben (keine Spalten löschen, solange eine ältere Version sie noch braucht).

---

## Checkliste vor der Abgabe

- [ ] Monatliches Ausgabelimit in der Mistral-Konsole gesetzt.
- [ ] Registrierung in `notebooklm-prod` deaktiviert.
- [ ] `db:seed` gegen Produktion ausgeführt, Demo-Login funktioniert.
- [ ] Hauptfluss live durchgespielt: Login, Notebook, Upload, Verarbeitung, Frage, Zitat, Export.
- [ ] Keine Secrets im Repository (`.env`-Dateien ignoriert, Historie geprüft).
- [ ] Keine Demo-Zugangsdaten im Repository oder auf der Live-Seite.
- [ ] README-Links zu Live-Demo und Loom-Video gesetzt.
- [ ] **Pausierung geprüft:** Supabase pausiert Free-Projekte nach längerer Inaktivität. Prüfen, ob das Polling von pg-boss das Projekt aktiv hält. Falls nicht, für die Bewerbungsphase einen Keep-alive einrichten.
