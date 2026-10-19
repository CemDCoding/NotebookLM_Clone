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
