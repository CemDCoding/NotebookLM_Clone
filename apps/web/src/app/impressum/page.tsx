import type { Metadata } from 'next';
import { getLegalContact } from '@/features/legal/legal-contact';
import { LegalPage } from '@/features/legal/legal-page';
import { LegalSection } from '@/features/legal/legal-section';
import { OperatorAddress } from '@/features/legal/operator-address';

export const metadata: Metadata = {
  title: 'Impressum',
};

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum">
      <LegalSection title="Angaben gemäß § 5 DDG">
        <OperatorAddress contact={getLegalContact()} />
      </LegalSection>

      <LegalSection title="Hinweis zum Angebot">
        <p>
          Quellenchat ist ein nicht kommerzielles Lernprojekt, entstanden als Bewerbungsaufgabe. Es
          ist ein Nachbau von NotebookLM und steht in keiner Verbindung zu Google. NotebookLM ist
          eine Marke von Google LLC.
        </p>
        <p>
          Antworten im Chat werden von einem KI-Modell erzeugt und stützen sich auf die von dir
          hochgeladenen Quellen. Prüfe wichtige Aussagen anhand der angegebenen Zitate.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
