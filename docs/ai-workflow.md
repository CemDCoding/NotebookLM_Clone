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

**Erkenntnis:** Die erste Fassung der Planung war zu umfangreich und enthielt technische Fehler. Erst die gezielten Review-Runden mit klaren Kriterien haben sie umsetzbar gemacht.

---

## Phase 2: Umsetzung

_Wird während der Meilensteine M0 bis M6 ergänzt._

---

## Grenzen und Korrekturen

_Wird laufend ergänzt: Stellen, an denen die KI falsch lag oder nachgesteuert werden musste, und wie das aufgefallen ist._
