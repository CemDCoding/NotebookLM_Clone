# KI-Workflow

Dieses Dokument beschreibt, wie KI-Werkzeuge in diesem Projekt eingesetzt wurden, wo sie geholfen haben und wo sie korrigiert werden mussten.

**Werkzeug:** Claude Code

---

## Grundprinzip

Die KI arbeitet als ausführender Entwickler, die Entscheidungen bleiben beim Menschen.

- **Verbindlicher Kontext statt Einzel-Prompts:** Die [`CLAUDE.md`](../CLAUDE.md) beschreibt Ziel, Architektur, Regeln und Meilensteine. Claude lädt sie in jeder Sitzung automatisch, ergänzt um die Dateien in `apps/web` und `apps/api`.
- **Kleine Schritte:** Gearbeitet wird meilensteinweise in Schritten, die einzeln prüfbar und committbar sind.
- **Kontrolle über Git:** Die KI führt keine schreibenden Git-Befehle aus. Jeder Commit wird vom Entwickler geprüft und selbst erstellt.
- **Prüfen statt vertrauen:** Lint, Typecheck und Tests laufen vor jedem Abschluss. Jeder Meilenstein wird live von Hand getestet.

---

## Phase 1: Planung

1. **Anforderungen per Fragerunden:** Bevor eine Zeile Dokumentation entstand, hat Claude in zehn Runden gezielte Fragen gestellt. Dabei ging es um Stack, Deployment, KI-Anbieter, Umfang, Sicherheit, Tests und Sprache. Die Webseiten des Arbeitgebers wurden einbezogen, um Schwerpunkte wie Datenschutz und austauschbare Modelle abzuleiten.
2. **Projektbeschreibung:** Aus den Antworten entstanden die `CLAUDE.md`-Dateien.
3. **Review-Runden:** Die Planung wurde zweimal gezielt auf Machbarkeit, Sicherheit, Skalierbarkeit und Sauberkeit geprüft. Gefunden und vor dem ersten Code behoben wurden unter anderem:
   - Limits, die sich durch Löschen umgehen ließen,
   - eine nicht umsetzbare Regel (Magic Bytes bei Textdateien),
   - eine Datenbank-Verbindungsart, die mit pg-boss nicht funktioniert hätte,
   - Funktionen, deren Aufwand nicht zur verfügbaren Zeit passte.
4. **Bewusste Vereinfachungen:** Jede Vereinfachung wurde mit Begründung und Weg in die Produktion dokumentiert (ADR 4, README).

5. **Build-Plan:** Ein eigener [Master-Prompt](prompts/build-plan-master-prompt.md) lässt eine neue Sitzung alle Projektdateien vollständig einlesen und daraus `docs/build-plan.md` erstellen. Das sind Arbeitspakete mit klarer Dateizuständigkeit, damit mehrere Coding-Agents parallel arbeiten können, ohne sich gegenseitig zu stören.

**Erkenntnis:** Die erste Fassung der Planung war zu umfangreich und enthielt technische Fehler. Erst die gezielten Review-Runden mit klaren Kriterien haben sie umsetzbar gemacht.

---

## Phase 2: Umsetzung

Grundlage ist der [Build-Plan](build-plan.md): 48 Arbeitspakete für Agents mit klarer Dateizuständigkeit, geordnet in Wellen. Quelle für alles Folgende sind [Devlog](devlog.md) und `git log`.

### Ablauf einer Welle

1. **Ein Worktree pro Paket:** Der Entwickler legt für jedes Paket einen eigenen Git-Worktree mit Branch `wp/<ID>` an. Pro Paket startet eine eigene Claude-Code-Sitzung mit dem immer gleichen Prompt: Build-Plan Abschnitt 2 lesen und das Paket umsetzen.
2. **Eigentum statt Absprache:** Jedes Paket nennt die Dateien, die es ändern darf. Fremde Änderungen meldet der Agent im Abschlussbericht, statt sie selbst zu machen. Parallele Agents kommen sich so nicht in die Quere.
3. **Abschlussbericht:** Ergebnis, geänderte Dateien, Checks, Abweichungen, Commit-Vorschlag.
4. **Review durch den Entwickler:** Checks selbst im Worktree ausführen statt den Bericht zu übernehmen, Diff gegen das Eigentum des Pakets abgleichen, auf Secrets prüfen, Akzeptanzkriterien gegen den Code halten.
5. **Merge und Integrationspunkt:** Der Entwickler committet und mergt die Pakete (zuerst Shared, dann API, Web, Ops). Danach laufen `lint`, `typecheck` und `test` im Hauptcheckout, und die neue Funktion wird von Hand gegen die dev-Umgebung geprüft.
6. **Deployment pro Meilenstein** mit Smoke-Test des Live-Zustands. Erst danach ist ein Meilenstein abgeschlossen.

### Verlauf nach Meilensteinen

| Meilenstein | Was die KI umgesetzt hat | Wie gearbeitet wurde |
|---|---|---|
| M0 Fundament | Workspace-Tooling, gemeinsame Verträge, NestJS-Gerüst, Datenbankanbindung, Next.js-Grundgerüst, Impressum und Datenschutz | Das erste Paket bewusst allein und nacheinander, um Ablauf und Review zu verstehen. Danach Pakete parallel in Worktrees. |
| M1 Login und Notebooks | JWT-Guard, Notebooks-CRUD mit Ownership-Prüfung, Seed-Skript, Login mit `proxy.ts`, Notebook-Übersicht | Drei, dann vier Pakete parallel. Ownership und RLS gegen die echte Datenbank gemessen, weil die Agent-Tests nur Ersatz-Repositories nutzen. |
| M2 Quellen | Verträge, Storage-Service, Typprüfung nach Inhalt, Upload-Limits mit Advisory-Lock, Sources-Endpunkte, Quellenliste und Dialog | Advisory-Lock mit Gegenprobe belegt. Zusätzliche Vertragslücken beim Eigentum der Test-Hilfen im Plan geschlossen. |
| M3 Ingestion | Textextraktion, Chunking, Embedding-Provider, pg-boss-Queue, Worker, Seed mit Beispielquelle, Status-Polling | Eigentum vor jeder Welle gegen den Code abgeglichen. Ende-zu-Ende in dev mit echter PDF, Bild-PDF und Markdown. |
| M4 Chat mit Zitaten | Chat-Verträge, Retrieval, Prompt-Aufbau mit Zitat-Zuordnung, Chat-Limits, SSE-Endpunkt mit Verlauf, SSE-Client, Antwort-Rendering, Chat-Panel | Sechs Pakete in Welle 2 parallel. Entwickelt auf `dev` weiter, obwohl M1 bis M3 wegen der Railway-Sperre noch nicht live waren (bewusste Abweichung, siehe Devlog). |
| M5 Feinschliff | Export-Vertrag und -Endpunkt, Sicherheits-Audit mit Checkliste, Zustände und Design-Politur, Einstellungsseite, Playwright-Test | Das Audit prüfte Nachweise statt Verhalten: Ein zentraler Test prüft das erzeugte SQL jeder Repository-Methode auf den `user_id`-Filter. |
| M6 Abgabe | README, ADRs, diese Dokumentation | Drei reine Doku-Pakete parallel. |

### Was der Mensch behalten hat

- Alle Git-Schreibbefehle, Merges, Pushes und Deployments.
- Konten, Secrets und deren Rotation (siehe Devlog 2026-10-22).
- Schreibende Zugriffe auf die Produktivdaten. Die Prüfung der Prod-Datenbank lief als vom Entwickler ausgeführtes, lesendes Skript.
- Die Entscheidung, wann etwas deployt wird und was als „fertig“ gilt.

---

## Grenzen und Korrekturen

Stellen, an denen die KI falsch lag, und wie das aufgefallen ist. Alle stehen mit Datum im Devlog.

**Fehleinschätzungen der KI**

- **Doku-Widerspruch, der keiner war** (2026-10-20): Claude hielt `pnpm --filter api` für falsch. Ein Test zeigte, dass pnpm den Kurznamen auflöst.
- **Messung ohne Nachweis** (2026-10-20): Claude schloss aus einem Netzwechsel-Test, das Rate-Limit zähle nach Proxy-IPs, und schlug einen eigenen Guard vor. Der Test hatte keinen gültigen IP-Nachweis, weil ein Netzwerkfilter den IP-Echo-Dienst blockierte. Die Wiederholung mit Zeitstempeln und IP-Hash widerlegte den Befund. Lehre: Eine Messung zählt erst, wenn ihre Vorbedingungen belegt sind.
- **Falsche Annahme zu Worktrees** (2026-10-22): Claude gab an, ein laufendes `pnpm dev` halte die Worktrees nicht fest. Wegen der Hardlinks im pnpm-Store sperrt ein laufendes `esbuild.exe` sie aber doch.
- **Fehlalarm im Prüfskript** (2026-10-23): Ein Skript meldete eine „verwaiste Datei“ im Storage. Es verglich mit `storage_path` statt mit dem Pfadschema, eingefügter Text hat aber eine Datei. Die Zahlen erklärten es eindeutig, ein Fehler der App war es nicht.
- **Verstoß gegen die Projektregel** (2026-10-23): Claude führte beim Review `git add -N` aus, einen schreibenden Git-Befehl. Folgen hatte es keine. Seitdem werden neue Dateien nur noch lesend betrachtet.
- **Prozess nicht beendet** (2026-10-23): Nach dem Beenden eines Hintergrundprozesses lief der Prozessbaum von `pnpm dev` weiter. Die Portprüfung meldete „frei“, weil Windows auf Deutsch `ABHÖREN` statt `LISTEN` ausgibt.
- **Reihenfolge** (2026-10-22): Der Seed lief vor der Prüfung der Chunks und löschte die Test-Uploads. Seitdem gilt: Prüfungen in der Datenbank vor Aktionen, die Daten zurücksetzen.

**Fehler im Plan, von der KI geschrieben**

- **Veraltete Annahme zu Railway** (2026-10-20): Die `railway.json` aus dem Plan wäre ignoriert worden, weil Railway Config as Code für neue Services abgekündigt hat. Aufgefallen erst im Dashboard.
- **Testdateinamen** (2026-10-21): Der Plan nannte `*.spec.ts`, Vitest sammelt nur `*.test.ts`. Solche Tests wären still nie gelaufen. Zwei Agents erkannten es.
- **Lücken beim Dateieigentum** (2026-10-21 bis 2026-10-22): Mehrere Pakete mussten Test-Hilfen außerhalb ihres Eigentums anpassen. Vor M3-W3 wurde das Eigentum deshalb gegen den Code abgeglichen und vor M4-W2 erneut ergänzt (`models.module.ts`, `app.module.test.ts`, `api-client.ts`).
- **Zählfehler im Plan** (2026-10-21): Statustabelle und Abschnitt 9 nannten unterschiedliche Paket- und Stundenzahlen.

**Fehler, die grüne Tests nicht zeigten**

- Der tägliche Aufräum-Job hing in einem Modul, das nur im HTTP-Teil lädt. Im Modus `worker` wäre er nie gelaufen. Aufgefallen im Review, belegt durch den Start in allen drei `RUN_MODE`s.
- `tsx` erzeugt keine Decorator-Metadaten, der Seed hätte die Abhängigkeit des `QueueService` nicht aufgelöst. Gemessen, mit Gegenprobe gegen den Nest-Build.
- Der E2E-Test lief im Agent nie wirklich, weil der passende Chromium fehlte.
- Ob pg-boss nach `SIGTERM` sauber stoppt, ließ sich unter Windows nicht messen. Erst im Railway-Log zeigte sich, dass das Signal durch `pnpm` und die `&&`-Kette nicht beim Node-Prozess ankam. Behoben mit `exec`.

**Erkenntnisse**

- Berichte der Agents sind Hinweise, keine Beweise. Checks, Ownership und RLS wurden selbst gemessen, jeweils mit Gegenprobe (Test rot ohne die geprüfte Regel).
- Parallele Agents sparen nur dann Zeit, wenn das Dateieigentum stimmt. Die Abgleiche vor einer Welle haben mehr Nacharbeit vermieden als sie gekostet haben.
- `pnpm install` in mehreren Worktrees ist ein Engpass. Der Vorteil eines vorherigen, nacheinander ausgeführten Installs ließ sich nicht belegen.

---

## Gliederung für das Loom-Video (3 bis 5 Minuten)

Zuerst die Live-Demo des Kernflusses, danach kurz Architektur, Sicherheit und KI-Vorgehen. Geplant sind 4:45 Minuten, die Reserve bis 5:00 fängt Wartezeiten beim Streaming auf.

| Zeit | Abschnitt | Inhalt |
|---|---|---|
| 0:00–0:15 | Einstieg | Ein Satz: Quellenchat ist ein Nachbau von NotebookLM, live unter dem Link im README. |
| 0:15–0:35 | Login | Anmeldung mit dem Demo-Account. Die Zugangsdaten stehen nicht im Video. |
| 0:35–1:05 | Notebook und Quelle | Notebook mit der Beispielquelle öffnen, Status „bereit“ zeigen. Optional kurz eine Quelle als Text einfügen. |
| 1:05–2:00 | Frage mit Zitaten | Frage stellen, deren Antwort nur in der Quelle steht (das Maskottchen). Die Antwort streamt auf Deutsch mit Zitaten. |
| 2:00–2:45 | Zitat-Popover und Seitenpanel | Hover über ein Zitat zeigt die Textstelle, Klick öffnet das Seitenpanel mit Abschnitt, Quellentitel und Seitenzahl. |
| 2:45–3:15 | Frage ohne Bezug | Frage, die die Quellen nicht beantworten. Der Assistent sagt das klar und erfindet nichts. |
| 3:15–3:45 | Architektur | Diagramm aus dem README: Next.js, NestJS, Supabase, Mistral. RAG-Ablauf in drei Schritten (Ingestion, Retrieval, Generierung). |
| 3:45–4:15 | Sicherheit | Ownership mit `404`, RLS ohne Policies, Limits, Schutz vor Prompt-Injection, EU-Hosting, Löschen und Export. |
| 4:15–4:45 | KI-Vorgehen | CLAUDE.md und Build-Plan, Wellen in Worktrees, Review durch den Entwickler. Eine Korrektur aus „Grenzen und Korrekturen“ als Beispiel, etwa die Rate-Limit-Messung. Verweis auf Devlog und ADR 4. |
