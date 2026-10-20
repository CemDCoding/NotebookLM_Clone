# ADR 0002: Drizzle und pg-boss auf Supabase Postgres statt Prisma und Redis

- **Status:** Angenommen
- **Datum:** 2026-10-19

## Kontext

Die Anwendung braucht relationale Daten, Vektorsuche (pgvector, 1024 Dimensionen) und eine Job-Queue für die asynchrone Ingestion. Supabase liefert Postgres, Auth und Storage in der EU-Region Frankfurt. Betrieb und Kosten sollen minimal bleiben: möglichst wenige Dienste, die konfiguriert, bezahlt und abgesichert werden müssen.

## Entscheidung

Als ORM dient **Drizzle** mit drizzle-kit für Migrationen. Die Job-Queue ist **pg-boss** und läuft in derselben Postgres-Datenbank. Die API verbindet sich über den **Session-Pooler von Supabase (Port 5432)**.

## Alternativen

| Alternative | Warum nicht gewählt |
|---|---|
| Prisma | pgvector wird nicht nativ unterstützt, Vektorabfragen erforderten Raw SQL ohne Typsicherheit. |
| Redis mit BullMQ | Zusätzlicher Dienst mit eigenen Kosten, eigener Absicherung und eigenem Betrieb. Jobs und Daten wären nicht transaktional verbunden. |
| Supabase-Client (PostgREST) für Datenzugriff | Umgeht die Schichten der API. Komplexe Abfragen wie Vektorsuche mit Filter lassen sich schlecht ausdrücken. |
| Transaction-Pooler (Port 6543) | pg-boss und Drizzle sind auf dauerhafte Sessions angewiesen. Der Transaction-Pooler bricht diese Annahme. |

## Konsequenzen

- **Positiv:** Ein einziger Datenspeicher für Daten, Vektoren und Jobs. Typsichere, SQL-nahe Abfragen auch für pgvector. Kein zusätzlicher Dienst.
- **Negativ / Kompromisse:** Die Verbindung muss über den **Session-Pooler** laufen, nicht über den Transaction-Pooler. Die Queue belastet dieselbe Datenbank wie die Anfragen. Drizzle ist jünger und weniger verbreitet als Prisma.
- **Weg in die Produktion:** Der Worker läuft als eigener Service (`RUN_MODE=worker`), die API getrennt (`RUN_MODE=api`). Bei großen Notebooks kommt ein HNSW-Index mit iterativem Scan hinzu. Bei hoher Queue-Last kann auf eine dedizierte Queue gewechselt werden.
