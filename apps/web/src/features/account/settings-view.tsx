import { ExportButton } from './export-button';

export function SettingsView() {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="export-heading"
        className="flex flex-col gap-3 rounded-xl border p-6"
      >
        <h2 id="export-heading" className="font-heading text-lg font-semibold">
          Datenexport
        </h2>
        <p className="text-sm text-muted-foreground">
          Lade alle deine Notebooks, die Angaben zu deinen Quellen und deine Chatverläufe als
          JSON-Datei herunter. Der Inhalt der Quellen selbst ist nicht enthalten.
        </p>
        <ExportButton />
      </section>
      <section
        aria-labelledby="delete-heading"
        className="flex flex-col gap-3 rounded-xl border p-6"
      >
        <h2 id="delete-heading" className="font-heading text-lg font-semibold">
          Account löschen
        </h2>
        <p className="text-sm text-muted-foreground">
          Zum Löschen deines Accounts wende dich an den Betreiber. Quellen, Notebooks und
          Chatverläufe kannst du jederzeit selbst löschen.
        </p>
      </section>
    </div>
  );
}
