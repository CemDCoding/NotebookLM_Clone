# ADR 0004: Bewusste Vereinfachungen für die Demo und ihr Weg in die Produktion

- **Status:** Angenommen
- **Datum:** 2026-10-24

## Kontext

Quellenchat ist ein Nachbau von NotebookLM als Bewerbungsaufgabe. Die Umsetzung hatte etwa eine Woche Zeit, neben einer Vollzeitstelle. Das Budget für KI-Anbieter, Hosting und Datenbank ist klein. Gleichzeitig gelten Sicherheit, Datenschutz und Quellentreue ohne Abstriche. Der Umfang wurde deshalb hart begrenzt (`CLAUDE.md §2`). Dieses ADR hält fest, welche naheliegenden Funktionen bewusst fehlen, warum das vertretbar ist und was sich in einer Produktivversion ändern müsste. Es folgt damit dem Grundsatz „Wo vereinfacht wird, geschieht das bewusst und dokumentiert“ (`CLAUDE.md §1`).

## Entscheidung

Die Demo verzichtet bewusst auf sechs Punkte. Jeder Punkt ist unten mit seinem Weg in die Produktion beschrieben. Keiner davon verschlechtert die Quellentreue der Antworten oder die Sicherheitsregeln aus `CLAUDE.md §7`.

1. **Nur Login, keine Registrierung.** Accounts legt der Betreiber per Seed-Skript an. Es gibt keinen E-Mail-Versand, keine Bestätigung und keine Account-Löschung durch Nutzer. Die Registrierung ist in Supabase abgeschaltet.
2. **Antworten nur auf Deutsch.** Prompt, Tests und Oberfläche sind auf Deutsch ausgelegt. Andere Sprachen sind nicht umgesetzt.
3. **Chunking nach Zeichen statt nach Tokens.** Abschnitte haben höchstens 3.000 Zeichen mit 400 Zeichen Überlappung (`PE-13`). Die Grenzen folgen Absätzen und Sätzen. Ein Tokenzähler wäre eine zusätzliche Abhängigkeit ohne spürbaren Nutzen für diesen Umfang.
4. **Ein Prozess für API und Worker, exakte Vektorsuche.** Standardmäßig läuft `RUN_MODE=all`. Die Vektorsuche sortiert die gefilterten Abschnitte exakt nach Kosinusdistanz, ohne HNSW-Index.
5. **Zwei Spalten ohne Studio-Funktionen, nur Desktop.** Das Layout zeigt Quellen und Chat nebeneinander. Zusammenfassungen, FAQ, Study Guide und Audio-Overview fehlen. Mobile Layouts sind nicht optimiert.
6. **Keine Staging-Umgebung.** Es gibt die Umgebungen `dev` und `prod`. Der Integrationspunkt prüft auf `dev` gegen die echte Datenbank, nach jedem Deployment folgt ein Smoke-Test.

Ergänzend gilt: Der Ende-zu-Ende-Test (Playwright) deckt nur den Hauptfluss ab: Login, Notebook anlegen, Quelle einfügen, Frage stellen, Zitat sehen (`CLAUDE.md §11`). Die übrigen Pfade sind durch Unit- und Service-Tests mit gefakten Repositories und KI-Providern abgesichert.

## Alternativen

| Alternative | Warum nicht gewählt |
|---|---|
| Alle Studio-Funktionen und Mobile-Optimierung umsetzen | Mehrere Wochen Arbeit. Der Kern (Quellen, Chat, Zitate) wäre dann nicht fertig geworden. |
| Registrierung mit E-Mail-Bestätigung über eigenen SMTP | Zusätzlicher Dienst, Versandkonfiguration und Schutz vor Massenregistrierungen. Für eine Demo mit einem Demo-Account nicht nötig. |
| Mehrsprachige Antworten | Jede Sprache bräuchte eigene Prompt- und Zitat-Tests. Die Qualität der Zitatzuordnung wäre schwerer zu prüfen. |
| Chunking nach Tokens | Braucht einen modellabhängigen Tokenizer als Abhängigkeit. Zeichenbasiertes Chunking ist für die Demo gleich verlässlich. |
| Worker als eigener Service von Anfang an | Ein zweiter Railway-Service kostet Geld und Betriebsaufwand. Derselbe Code startet mit `RUN_MODE=worker` jederzeit separat (ADR 0002). |
| HNSW-Index für die Vektorsuche | Bei den Datenmengen der Demo unnötig. Die exakte Suche ist korrekt und einfach zu prüfen. |
| Dritte Supabase-Umgebung als Staging | Das dritte Projekt wäre kostenpflichtig. Eine Staging-API gegen `dev` würde Jobs aus derselben pg-boss-Queue ziehen (`docs/deployment.md`). |

## Konsequenzen

- **Positiv:** Der Umfang passt in die verfügbare Zeit, ohne die Sicherheitsregeln oder die Quellentreue aufzuweichen. Jede Lücke ist benannt und begründet, und der Code bleibt so angelegt, dass die Erweiterungen Schritt für Schritt möglich sind.
- **Negativ / Kompromisse:** Die Demo ist nicht für Massennutzung, Mehrsprachigkeit oder kleine Bildschirme ausgelegt. Die Prüfung der Live-Umgebung stützt sich außer auf den E2E-Test auf manuelle Smoke-Tests nach jedem Deployment.
- **Weg in die Produktion:**
  - **Registrierung:** Supabase-Registrierung mit E-Mail-Bestätigung über eigenen SMTP, dazu Account-Löschung durch den Nutzer und Missbrauchsschutz bei der Anmeldung. Die Datenschutzerklärung wird im selben Schritt angepasst (`CLAUDE.md §7`).
  - **Mehrsprachigkeit:** Die Antwortsprache wird aus der Frage abgeleitet und im Prompt vorgegeben, mit eigenen Prompt- und Zitat-Tests je Sprache. Die Oberfläche bekommt eine Übersetzungsschicht.
  - **Tokenbasiertes Chunking:** Ein Wechsel ändert die Abschnitte und verlangt eine Neuindizierung aller Quellen, ähnlich wie ein Embedding-Wechsel (ADR 0003).
  - **Worker und HNSW:** Derselbe Code läuft als `RUN_MODE=api` und `RUN_MODE=worker` in getrennten Services. Ein HNSW-Index mit iterativem Scan kommt dazu, sobald Notebooks groß werden (ADR 0002).
  - **Layout:** Responsives Layout für kleine Bildschirme. Die Studio-Funktionen erhalten eigene Bereiche neben Quellen und Chat.
  - **Staging:** Ein eigenes Supabase-Projekt als Staging mit eigener Datenbank und eigener pg-boss-Queue. Erst dann ist eine Staging-API sinnvoll.
