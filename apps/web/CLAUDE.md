# apps/web – Next.js-Frontend

Ergänzt die Root-[`CLAUDE.md`](../../CLAUDE.md). Die dortigen Regeln zu Sicherheit, Konventionen und Arbeitsweise gelten hier vollständig.

Das Frontend ist eine **Desktop-Webanwendung** mit deutscher Oberfläche. Es nutzt Supabase nur für den Login und holt alle Daten über die NestJS-API.

---

## Struktur

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/login/          # Login (keine Registrierung)
│   │   ├── (app)/notebooks/       # Notebook-Übersicht
│   │   ├── (app)/notebooks/[id]/  # Notebook-Ansicht: Quellen + Chat
│   │   ├── (app)/settings/        # Datenexport
│   │   ├── impressum/             # Impressum (öffentlich)
│   │   ├── datenschutz/           # Datenschutzerklärung (öffentlich)
│   │   └── layout.tsx
│   ├── components/
│   │   ├── site-footer.tsx        # Footer der öffentlichen Seiten: Rechtliches, Markenhinweis
│   │   └── ui/                    # shadcn/ui-Komponenten (generiert, nur gezielt anpassen)
│   ├── features/
│   │   ├── legal/                 # Anbieterangaben aus der Umgebung, Rahmen der Rechtsseiten
│   │   ├── notebooks/
│   │   ├── sources/
│   │   ├── chat/
│   │   └── account/
│   ├── lib/
│   │   ├── api-client.ts          # Fetch-Wrapper mit Token und Zod-Parsing
│   │   ├── sse.ts                 # Liest den Chat-Stream per fetch
│   │   └── supabase/              # Browser- und Server-Client (@supabase/ssr)
│   └── proxy.ts                   # Schützt (app)-Routen, erneuert die Session
└── e2e/                           # Playwright-Test
```

`proxy.ts` ist seit Next.js 16 der Name der früheren `middleware.ts`. Maßgeblich ist die in `package.json` installierte Version. Die dazu passende Next.js-Dokumentation liegt nach `pnpm install` unter `apps/web/node_modules/next/dist/docs/`. Sie hat Vorrang vor älterem Wissen über Next.js (Risiko R12 im Build-Plan).

Ein Feature-Ordner enthält alles Fachliche zu seinem Thema: Komponenten, Query-Hooks und kleine Hilfsfunktionen. Geteilte, fachfreie Bausteine liegen in `components/`.

---

## Konventionen

### Komponenten

- **Server Components** sind der Standard. `"use client"` nur, wo Interaktivität, Browser-APIs oder Hooks nötig sind.
- Eine Komponente pro Datei, Dateiname in `kebab-case`, Komponentenname in `PascalCase`.
- Props sind explizit typisiert. Keine Komponente greift direkt per `fetch` auf die API zu, sondern über `api-client` und Query-Hooks.

### Daten und State

- **TanStack Query** für alle Serverdaten. Query-Keys sind pro Feature zentral definiert.
- Nach Mutationen werden die betroffenen Queries gezielt invalidiert.
- Quellen mit Status `pending` oder `processing` werden gepollt, bis sie `ready` oder `failed` sind.
- Lokaler UI-State bleibt in `useState`. Kein globaler State-Store ohne konkreten Bedarf.
- Antworten der API werden mit den Zod-Schemas aus `packages/shared` geparst. Damit stimmen die Typen zur Laufzeit.
- `packages/shared` wird über `transpilePackages` in `next.config` eingebunden.

### Authentifizierung

- Login und Session laufen über `@supabase/ssr`. `proxy.ts` leitet nicht angemeldete Nutzer auf `/login` um.
- Die Login-Seite hat **nur** ein Anmeldeformular. Es gibt keine Registrierung, kein „Passwort vergessen“ und keine Änderung von Passwort oder E-Mail-Adresse. Ein kurzer Hinweis erklärt, dass Zugänge vergeben werden.
- Der `api-client` hängt das Access-Token als `Authorization: Bearer …` an. Bei `401` wird die Session erneuert oder zum Login weitergeleitet.
- **Keine Demo-Zugangsdaten** im Code, in der UI oder in Platzhaltern. Sie werden nur außerhalb des Repos weitergegeben.

### Umgebungsvariablen

Im Frontend werden **nur** diese Variablen verwendet, dokumentiert in `apps/web/.env.example`. Niemals Service-Role-Keys oder KI-API-Keys.

| Variable | Zweck |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt für die Anmeldung |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Öffentlicher Schlüssel für die Anmeldung |
| `NEXT_PUBLIC_API_URL` | Basis-URL der NestJS-API |
| `IMPRESSUM_NAME`, `IMPRESSUM_STREET`, `IMPRESSUM_CITY`, `IMPRESSUM_EMAIL` | Anbieterangaben für Impressum und Datenschutzerklärung. Nur serverseitig (kein `NEXT_PUBLIC_`), beim Build in die statischen Seiten gerendert. Fehlt eine davon, bricht der Produktions-Build auf Vercel (`VERCEL_ENV=production`) ab. |

### Öffentliche Seiten und Rechtliches

- Die öffentlichen Seiten (Start, Login, Impressum, Datenschutz) zeigen unten den `SiteFooter` mit den Links zu Impressum und Datenschutz.
- Sichtbarer App-Name ist **Quellenchat**. „NotebookLM“ steht nur beschreibend im Markenhinweis.

### Texte

- Alle sichtbaren Texte sind auf **Deutsch**, in der Du-Form, kurz und konkret.
- Fehlermeldungen sagen, was passiert ist und was der Nutzer tun kann, z. B. „Die Datei ist größer als 10 MB. Bitte lade eine kleinere Datei hoch.“
- Bei Limits (`429`) wird die Meldung der API angezeigt, z. B. „Du hast das Stundenlimit für Fragen erreicht. Versuche es später erneut.“
- Kein i18n-Framework. Texte stehen direkt in den Komponenten.

---

## Design

Layout nach dem Vorbild von NotebookLM, Optik im hellen, ruhigen Stil von RelationFlow.

- **Notebook-Ansicht mit zwei Spalten:** links die Quellenliste (fest, ca. 320 px), rechts der Chat. Keine Studio-Spalte.
- **Stil:** viel Weißraum, helle Flächen, feine Rahmen statt schwerer Schatten, abgerundete Ecken, ein **blauer Akzent** für Primäraktionen und Zitat-Marker. Überschriften dürfen eine kursive Serif-Hervorhebung nutzen.
- Farben, Radien und Abstände kommen aus den Tailwind- und shadcn-Design-Tokens. Keine hart codierten Farbwerte in Komponenten.
- Nur Light Mode. Ausgelegt für Desktop ab 1280 px Breite. Keine mobile Optimierung.

### Pflichtzustände

Jede Ansicht gestaltet alle Zustände bewusst:

| Zustand | Beispiel |
|---|---|
| Laden | Skeletons für Notebook-Liste und Quellen, Tipp-Indikator im Chat |
| Leer | „Noch keine Quellen. Lade ein PDF hoch oder füge Text ein, um loszulegen.“ |
| Fehler | Verständliche Meldung mit Aktion („Erneut versuchen“) |
| Verarbeitung | Statusanzeige pro Quelle: wartet, wird verarbeitet, bereit, fehlgeschlagen |

---

## Quellen hinzufügen

- Upload per Dateiauswahl oder Drag and Drop. Größe und Endung werden schon im Browser geprüft, damit der Nutzer sofort eine Rückmeldung bekommt. Die verbindliche Prüfung macht die API.
- Das Feld für eingefügten Text zeigt einen **Zeichenzähler** mit dem Limit aus `packages/shared` (500.000 Zeichen). Über dem Limit ist das Absenden deaktiviert.

---

## Chat und Zitate

- Der Chat-Stream wird per **`fetch` mit `ReadableStream`** gelesen, nicht mit `EventSource`, weil `EventSource` keinen `Authorization`-Header senden kann. Die Events `token`, `citations`, `done` und `error` werden in `lib/sse.ts` gegen die Schemas aus `packages/shared` geparst.
- Während einer Antwort ersetzt ein **Stopp-Button** den Senden-Button. Er bricht den `fetch` per `AbortController` ab, die API bricht daraufhin die Anfrage an das Modell ab. Auch beim Verlassen der Seite wird der laufende Stream abgebrochen. Die abgebrochene Antwort wird als „Abgebrochen“ markiert und nicht gespeichert.
- Markdown wird mit `react-markdown` **ohne** `rehype-raw` gerendert, also ohne rohes HTML (XSS-Schutz).
- **Zitat-Marker:**
  - Während des Streamings erscheinen `[n]` als neutraler, gedämpfter Text.
  - Sobald das `citations`-Event eintrifft, werden nur die darin enthaltenen Nummern zu klickbaren Badges. Nicht enthaltene Nummern werden entfernt.
  - **Hover:** Popover mit Quellentitel, Seitenzahl und Textauszug.
  - **Klick:** Ein Seitenpanel zeigt den vollständigen zitierten Abschnitt mit Quellentitel und Seitenzahl. Kein PDF-Viewer.
- Der **Modell-Picker** sitzt am Eingabefeld und zeigt nur Modelle, die die API freigibt. Vorausgewählt ist das Standardmodell der API (das günstigste). Lokale Ollama-Modelle tragen das Label „Lokal“.
- Der Chat-Verlauf eines Notebooks lässt sich mit Bestätigungsdialog löschen.
- Sind keine Quellen aktiv und bereit, ist das Eingabefeld deaktiviert und erklärt den Grund.

---

## Zugänglichkeit

- Semantisches HTML: Buttons sind `<button>`, Links sind `<a>`.
- Alle Aktionen sind per Tastatur erreichbar, Fokus ist sichtbar. Enter sendet eine Frage, Shift+Enter erzeugt einen Zeilenumbruch.
- Icon-Buttons haben ein `aria-label`. Der gestreamte Chat-Bereich nutzt `aria-live="polite"`.
- Destruktive Aktionen (Löschen) verlangen immer eine Bestätigung.

---

## Tests

- **Vitest + React Testing Library:** Zitat-Verarbeitung (gültige und ungültige Nummern), SSE-Parsing inklusive Abbruch, Formularvalidierung mit Zeichenlimit, Statusanzeige der Quellen.
- **Playwright (`e2e/`):** ein Test für den Hauptfluss gegen die Entwicklungsumgebung – anmelden, Notebook anlegen, Text-Quelle einfügen, warten bis „bereit“, Frage stellen, Zitat-Popover prüfen. Zugangsdaten kommen aus Umgebungsvariablen.
- Tests nutzen zugängliche Selektoren (`getByRole`, `getByLabel`), keine CSS-Klassen.
