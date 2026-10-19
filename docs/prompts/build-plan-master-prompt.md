# Master-Prompt: Build-Plan

Dieser Prompt startet eine neue Claude-Code-Sitzung, die den vollständigen Build-Plan für den NotebookLM-Klon erstellt. Der Plan ist die Arbeitsgrundlage für mehrere parallel arbeitende Coding-Agents und gleichzeitig für Menschen lesbar.

**Empfohlenes Modell:** Claude Opus 5.5 mit hohem Reasoning-Aufwand (Effort `high` oder höher).

**Verwendung:** Neue Sitzung im Projektordner starten und schreiben:

> Lies `docs/prompts/build-plan-master-prompt.md` und führe den Prompt im Abschnitt „Prompt“ vollständig aus.

**Ergebnis:** `docs/build-plan.md`

---

## Prompt

### Rolle

Du bist ein erfahrener technischer Projektplaner und Tech Lead für TypeScript-Full-Stack-Projekte (Next.js, NestJS, Supabase, RAG-Systeme). Du zerlegst Vorhaben in klar abgegrenzte, parallel bearbeitbare Arbeitspakete, denkst Abhängigkeiten, Schnittstellen und Risiken vorher durch und planst realistisch für die verfügbare Zeit.

Du schreibst in dieser Sitzung **keinen Anwendungscode**. Dein einziges Ergebnis ist der Build-Plan.

### Auftrag

Erstelle einen vollständigen Build-Plan für die gesamte Anwendung, so wie sie in der Projektdokumentation beschrieben ist, und speichere ihn als `docs/build-plan.md`.

Der Plan muss zwei Lesergruppen dienen:

1. **Parallelen Coding-Agents:** Jedes Arbeitspaket ist so eindeutig beschrieben, dass ein Agent es ohne Rückfragen und ohne Wissen über die anderen Pakete umsetzen kann, und zwar ohne Konflikte mit parallel laufenden Agents.
2. **Dem Entwickler:** Er muss den Plan schnell überblicken, den Fortschritt verfolgen und seine eigenen manuellen Schritte erkennen können.

### Schritt 1: Vollständig einlesen, bevor du planst

Bevor du irgendetwas planst oder schreibst:

1. Liste **alle** Dateien und Ordner im Projekt auf, außer `.git/` und `node_modules/`.
2. Lies **jede** dieser Dateien vollständig. Überspringe keine und lies keine nur teilweise. Dazu gehören mindestens:
   - `CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/api/CLAUDE.md`
   - `README.md`
   - `docs/deployment.md`, `docs/devlog.md`, `docs/ai-workflow.md`, `docs/adr/0000-vorlage.md`
   - `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `.nvmrc`
   - `apps/web/.env.example`, `apps/api/.env.example`
   - alle Dateien unter `packages/shared/`
   - alle weiteren Dateien, die beim Auflisten auftauchen
3. Prüfe mit lesenden Befehlen, welche Werkzeuge lokal installiert sind (z. B. `node -v`, `pnpm -v`). Ändere dabei nichts.
4. Fasse danach in wenigen Sätzen zusammen, was du gelesen hast und was der aktuelle Stand des Projekts ist.

Die Projektdokumentation ist die verbindliche Quelle. Triff keine Annahmen, die ihr widersprechen. Was nicht festgelegt ist, entscheidest du begründet und markierst es im Plan als Planungsentscheidung.

### Schritt 2: Widersprüche und Lücken klären

Wenn du beim Lesen auf Widersprüche, Lücken oder Unklarheiten stößt, die den Plan wesentlich beeinflussen, **frage zuerst nach**, bevor du den Plan schreibst. Stelle die Fragen gebündelt und mit einer Empfehlung pro Frage. Kleinere Unklarheiten löst du selbst und führst sie im Plan unter „Planungsentscheidungen“ auf.

### Schritt 3: Den Plan erstellen

#### Grundsätze

- **Meilensteine sind verbindlich.** Der Plan folgt den Meilensteinen M0 bis M7 aus `CLAUDE.md`, Abschnitt 10, einschließlich des Live-Zustands nach jedem Deployment. Jeder Meilenstein endet mit einem Deployment-Paket.
- **Verträge zuerst.** Zod-Schemas, API-Typen und SSE-Events in `packages/shared` werden in eigenen Paketen definiert, *bevor* Web und API parallel daran arbeiten. Dann können Frontend- und Backend-Agents gleichzeitig gegen denselben Vertrag bauen.
- **Klare Dateizuständigkeit.** Jede Datei und jeder Ordner gehört innerhalb einer parallelen Phase genau einem Arbeitspaket. Zwei Pakete, die gleichzeitig laufen können, dürfen nie dieselbe Datei ändern. Gemeinsam genutzte Dateien (z. B. `app.module.ts`, `schema.ts`, Root-`package.json`) bekommen eine ausdrückliche Regel: Wer ändert sie wann, und wie wird integriert?
- **Kleine Pakete.** Ein Arbeitspaket passt in eine Agent-Sitzung und ergibt einen einzeln committbaren, getesteten Stand. Richtwert: 1 bis 3 Stunden.
- **Menschliche Schritte sichtbar.** Alles, was ein Agent nicht tun kann oder darf, ist als eigener Schritt mit der Markierung **[Mensch]** aufgeführt. Dazu gehören Git-Commits und Pushes, das Anlegen der Supabase-Projekte und das Einrichten von Railway, Vercel und dem Mistral-Key (inkl. Ausgabelimit), das Installieren von Node.js/pnpm und manuelle Smoke-Tests.
- **Machbarkeit.** Der Entwickler arbeitet Vollzeit und hat etwa eine Woche Abendzeit. Schätze den Aufwand ehrlich, prüfe die Summe gegen dieses Budget und kennzeichne Pakete, die bei Zeitnot gekürzt oder gestrichen werden können, ohne Fundament oder Sicherheit zu gefährden.
- **Verweise statt Wiederholung.** Wiederhole keine Regeln aus der Dokumentation. Verweise präzise auf Datei und Abschnitt, z. B. `CLAUDE.md §7 „Missbrauchsschutz und Kostenkontrolle“` oder `apps/api/CLAUDE.md „chat“`. Jedes Arbeitspaket nennt die Abschnitte, die der Agent vor dem Start lesen muss.

#### Aufbau von `docs/build-plan.md`

1. **Titel, Stand, Kurzüberblick:** Was der Plan abdeckt und wie er zu benutzen ist, in maximal zehn Zeilen.
2. **So arbeiten Agents mit diesem Plan:** Kurze, verbindliche Regeln für jeden Coding-Agent:
   - vor dem Start `CLAUDE.md`, die passende App-`CLAUDE.md` und alle im Paket genannten Abschnitte lesen,
   - nur die eigenen Dateien ändern,
   - keine schreibenden Git-Befehle,
   - vor dem Abschluss `pnpm lint`, `pnpm typecheck` und `pnpm test` ausführen,
   - am Ende eine Commit-Message nach Conventional Commits vorschlagen und Abweichungen melden.
3. **Statusübersicht:** Eine Tabelle aller Arbeitspakete mit ID, Titel, Meilenstein, Lane, Abhängigkeiten, Aufwand und einer Status-Spalte (`offen` / `in Arbeit` / `fertig`), damit der Entwickler den Fortschritt pflegen kann.
4. **Abhängigkeitsgraph:** Ein Mermaid-Diagramm aller Arbeitspakete, gruppiert nach Meilenstein, mit sichtbaren parallelen Strängen.
5. **Lanes:** Die parallelen Arbeitsstränge (z. B. Shared/Verträge, API, Web, Infrastruktur und Doku, Mensch). Pro Lane: Zuständigkeit und Ordner.
6. **Meilensteine im Detail:** Pro Meilenstein:
   - Ziel und Live-Zustand nach dem Deployment (Verweis auf `CLAUDE.md §10`),
   - welche Pakete nacheinander und welche parallel laufen, als **Wellen** (Welle 1, Welle 2 …), wobei alle Pakete einer Welle gleichzeitig laufen können,
   - Integrationspunkt: wer die Teile zusammenführt und wie geprüft wird,
   - Deployment-Paket mit Smoke-Test-Checkliste (Verweis auf `docs/deployment.md`).
7. **Arbeitspakete:** Jedes Paket mit genau diesen Feldern:
   - **ID und Titel** (z. B. `M3-API-02 – Chunking nach Zeichen`)
   - **Meilenstein, Lane, Welle**
   - **Ziel:** ein bis zwei Sätze
   - **Pflichtlektüre:** Datei- und Abschnittsverweise
   - **Abhängigkeiten:** Paket-IDs, die vorher fertig sein müssen
   - **Parallel möglich mit:** Paket-IDs
   - **Dateien (Eigentum):** Was das Paket anlegt oder ändert
   - **Nicht anfassen:** Dateien, die zu parallelen Paketen gehören, falls Verwechslungsgefahr besteht
   - **Umsetzung:** knappe, konkrete Schritte, keine fertigen Code-Blöcke
   - **Schnittstellen:** Welche Verträge aus `packages/shared` genutzt oder bereitgestellt werden
   - **Akzeptanzkriterien:** prüfbar formuliert
   - **Tests:** welche Tests das Paket schreibt (gemäß `CLAUDE.md §11 „Tests“`)
   - **Doku-Pflichten:** z. B. `.env.example`, README, ADR, Devlog
   - **Aufwand:** S (bis 1 h), M (1–2 h), L (2–3 h)
   - **Kürzbar bei Zeitnot:** ja/nein, mit Begründung
   - **Commit-Vorschlag:** Conventional Commit mit Scope
8. **Menschliche Schritte:** Alle **[Mensch]**-Schritte in Reihenfolge, mit dem Zeitpunkt, ab wann sie nötig sind, und was sie blockieren.
9. **Zeitbudget:** Summe der Aufwände pro Meilenstein und gesamt, verglichen mit dem verfügbaren Budget, plus Kürzungsreihenfolge bei Zeitnot.
10. **Risiken:** Die wichtigsten technischen und organisatorischen Risiken mit Gegenmaßnahme und betroffenen Paketen.
11. **Planungsentscheidungen:** Alles, was die Dokumentation offen ließ und du entschieden hast, jeweils mit Begründung.
12. **Abdeckungsmatrix:** Jede Anforderung aus `CLAUDE.md §2` (Umfang) und jede Regel aus `CLAUDE.md §7` (Sicherheit und Datenschutz) mit dem Paket bzw. den Paketen, die sie umsetzen.

### Schritt 4: Selbstprüfung vor dem Speichern

Prüfe den Plan, bevor du ihn speicherst, und korrigiere jeden gefundenen Mangel:

- [ ] Jede Datei des späteren Projekts ist innerhalb jeder Welle höchstens einem Paket zugeordnet.
- [ ] Der Abhängigkeitsgraph ist frei von Zyklen, und jede Abhängigkeit zeigt auf ein existierendes Paket.
- [ ] Jeder Meilenstein endet mit einem Deployment-Paket und erreicht den Live-Zustand aus `CLAUDE.md §10`.
- [ ] Jede Anforderung aus `CLAUDE.md §2` und jede Regel aus `§7` taucht in der Abdeckungsmatrix auf.
- [ ] Kein Paket widerspricht der Dokumentation (Stack, Bewusst-nicht-im-Umfang, Limits, Git-Regel).
- [ ] Alle Verweise zeigen auf existierende Dateien und Abschnitte.
- [ ] Das Zeitbudget ist ehrlich und es gibt eine klare Kürzungsreihenfolge.
- [ ] Ein Agent könnte jedes Paket allein mit dem Paket und der Pflichtlektüre umsetzen.

### Regeln für diese Sitzung

- Schreibe nur `docs/build-plan.md`. Ändere keine anderen Dateien. Brauchen andere Dokumente nach deiner Analyse Anpassungen, liste sie im Plan unter „Planungsentscheidungen“ als Vorschlag auf.
- Führe keine schreibenden Git-Befehle aus.
- Installiere nichts und führe keine Build-Befehle aus.
- Schreibe auf Deutsch, wie die übrige Projektdokumentation. Paket-IDs, Dateinamen und Commit-Messages bleiben englisch bzw. technisch.
- Fasse am Ende in wenigen Sätzen zusammen: Anzahl der Pakete, Gesamtaufwand im Vergleich zum Budget, die größten Risiken und welche [Mensch]-Schritte als Erstes anstehen.
