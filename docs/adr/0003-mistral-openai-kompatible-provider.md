# ADR 0003: Mistral als EU-Anbieter hinter einer OpenAI-kompatiblen Provider-Schicht

- **Status:** Angenommen
- **Datum:** 2026-10-19

## Kontext

Die Anwendung verarbeitet Dokumente der Nutzer und muss DSGVO-freundlich sein. Die KI-Kosten trägt der Entwickler, das Budget ist klein. Lokal soll ohne Kosten und ohne Datenabfluss entwickelt werden können. Der Anbieter soll eine Konfigurationsfrage sein, keine Architekturfrage.

## Entscheidung

Alle Modelle werden über **eine OpenAI-kompatible Provider-Schnittstelle** angesprochen. Live ist **Mistral AI** (EU) der Anbieter, lokal **Ollama**, sobald `OLLAMA_BASE_URL` gesetzt ist. Chat-Standard ist `mistral-small-latest`, Alternative `ministral-8b-latest`. Für Embeddings dient in allen Umgebungen **`mistral-embed`** (1024 Dimensionen) als festes Modell. Die erlaubten Chat-Modelle kommen aus der Konfiguration der API, das Frontend sendet keine beliebigen Modellnamen.

## Alternativen

| Alternative | Warum nicht gewählt |
|---|---|
| OpenAI direkt | US-Anbieter, für ein DSGVO-Argument schwächer und teurer. |
| Anthropic- oder Gemini-SDK direkt | Anbieterspezifischer Code in den Fachmodulen, kein einfacher Wechsel. |
| Ollama-Embeddings lokal, Mistral live | Vektoren verschiedener Modelle sind nicht vergleichbar. Entwicklungs- und Live-Daten wären nicht austauschbar. |
| Selbst gehostete Modelle live | Betrieb und Kosten für GPU-Hosting sprengen Zeit und Budget. |

## Konsequenzen

- **Positiv:** EU-Verarbeitung, günstige Standardmodelle, ein Code-Pfad für alle Anbieter. Weitere Anbieter (OpenAI, OpenRouter, Gemini) kommen allein per Konfiguration hinzu.
- **Negativ / Kompromisse:** Alle Vektoren müssen aus `mistral-embed` stammen, auch lokal, sodass die Entwicklung einen Mistral-Key braucht. Ein Wechsel des Embedding-Modells erfordert eine Neuindizierung und ist eine Architekturentscheidung. Anbieterspezifische Funktionen jenseits der OpenAI-Schnittstelle sind nicht nutzbar.
- **Weg in die Produktion:** Höhere Anbieter-Stufe oder weitere Provider über die Provider-Schicht. Ein Embedding-Wechsel wird als neuer ADR mit Migrationsplan festgehalten.
