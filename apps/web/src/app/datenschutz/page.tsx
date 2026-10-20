import type { Metadata } from 'next';
import { getLegalContact } from '@/features/legal/legal-contact';
import { LegalPage } from '@/features/legal/legal-page';
import { LegalSection } from '@/features/legal/legal-section';
import { OperatorAddress } from '@/features/legal/operator-address';

export const metadata: Metadata = {
  title: 'Datenschutz · Quellenchat',
};

// Keep this text in sync with the actual processing (CLAUDE.md section 7, "DSGVO"):
// a new provider or a new kind of data changes it in the same step.
export default function DatenschutzPage() {
  return (
    <LegalPage title="Datenschutzerklärung">
      <LegalSection title="Verantwortlicher">
        <OperatorAddress contact={getLegalContact()} />
      </LegalSection>

      <LegalSection title="Überblick">
        <p>
          Quellenchat ist ein nicht kommerzielles Lernprojekt. Es gibt keine Werbung, kein Tracking
          und keine Analyse-Werkzeuge. Schriftarten werden von dieser Website selbst ausgeliefert,
          beim Aufruf entsteht keine Verbindung zu Google.
        </p>
      </LegalSection>

      <LegalSection title="Aufruf der Website">
        <p>
          Die Website wird bei Vercel Inc. (USA) gehostet, die Anwendung (API) bei Railway Corp.
          (USA) in einem Rechenzentrum in der EU. Beim Aufruf verarbeiten beide Anbieter technisch
          notwendige Daten wie IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserangaben in
          Server-Protokollen. Das ist nötig, um die Seite auszuliefern und vor Angriffen zu
          schützen. Rechtsgrundlage ist das berechtigte Interesse des Betreibers an einem sicheren
          Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p>
          Die Anwendung selbst protokolliert keine Inhalte von Dokumenten, Fragen oder Antworten,
          sondern nur technische Angaben wie Status, Dauer und Fehlerart.
        </p>
      </LegalSection>

      <LegalSection title="Anmeldung">
        <p>
          Eine Registrierung gibt es nicht, Zugänge werden vom Betreiber vergeben. Für die Anmeldung
          verarbeitet Supabase Inc. (USA) mit Speicherort Frankfurt am Main deine E-Mail-Adresse,
          dein Passwort (nur als Hash) und die Zeitpunkte deiner Anmeldungen.
        </p>
        <p>
          Damit du angemeldet bleibst, speichert dein Browser ein Sitzungs-Cookie. Es ist für die
          Anmeldung technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Weitere Cookies gibt es nicht.
          Rechtsgrundlage ist die Bereitstellung des Zugangs (Art. 6 Abs. 1 lit. b DSGVO).
        </p>
      </LegalSection>

      <LegalSection title="Notebooks, Quellen und Chat">
        <p>
          Deine Notebooks, hochgeladenen Dateien, daraus erzeugten Textabschnitte und Chatverläufe
          werden bei Supabase in Frankfurt am Main gespeichert. Damit Fragen beantwortet werden
          können, werden deine Fragen und passende Textabschnitte deiner Quellen an Mistral AI
          (Paris, Frankreich) übermittelt, um Suchvektoren und Antworten zu erzeugen. Nach den
          Bedingungen des genutzten kostenpflichtigen Tarifs verwendet Mistral AI diese Daten nicht
          zum Training seiner Modelle. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
        </p>
        <p>
          Um Missbrauch und Kosten zu begrenzen, zählt die Anwendung Chat-Anfragen und Uploads ohne
          deren Inhalt. Diese Zählereinträge werden nach sieben Tagen gelöscht.
        </p>
        <p>
          Bitte lade keine Dokumente mit besonders schützenswerten Daten hoch, etwa Gesundheits-
          oder Finanzdaten Dritter.
        </p>
      </LegalSection>

      <LegalSection title="Empfänger und Übermittlung in Drittländer">
        <p>
          Empfänger sind ausschließlich die genannten Dienstleister: Vercel, Railway, Supabase und
          Mistral AI. Gespeichert werden deine Inhalte in der EU. Vercel, Railway und Supabase sind
          Unternehmen mit Sitz in den USA. Soweit dabei Daten in die USA gelangen, stützt sich das
          auf den Angemessenheitsbeschluss zum EU-US Data Privacy Framework oder auf
          Standardvertragsklauseln der EU-Kommission.
        </p>
      </LegalSection>

      <LegalSection title="Speicherdauer">
        <p>
          Notebooks, Quellen und Chatverläufe bleiben gespeichert, bis du sie löschst. Beim Löschen
          werden Dateien, Textabschnitte, Suchvektoren und Nachrichten vollständig entfernt. Dein
          Zugang wird gelöscht, sobald er nicht mehr benötigt wird. Server-Protokolle der Hoster
          werden nach deren Fristen gelöscht.
        </p>
      </LegalSection>

      <LegalSection title="Deine Rechte">
        <p>
          Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art.
          17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
          Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Deine
          Daten kannst du in der Anwendung selbst löschen und als JSON exportieren. Für alles
          Weitere genügt eine E-Mail an die oben genannte Adresse.
        </p>
        <p>
          Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO),
          zum Beispiel bei der Behörde deines Bundeslandes.
        </p>
      </LegalSection>

      <p className="text-sm text-muted-foreground">Stand: Oktober 2026</p>
    </LegalPage>
  );
}
