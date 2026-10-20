import type { LegalContact } from './legal-contact';

interface OperatorAddressProps {
  contact: LegalContact | null;
}

/** Name, postal address and email of the operator, as required for the legal notice. */
export function OperatorAddress({ contact }: OperatorAddressProps) {
  if (!contact) {
    // Only reachable locally and in previews; a production build without the details fails.
    return (
      <p className="text-muted-foreground">
        Die Angaben zum Anbieter sind in dieser Umgebung nicht hinterlegt.
      </p>
    );
  }

  return (
    <address className="not-italic">
      {contact.name}
      <br />
      {contact.street}
      <br />
      {contact.city}
      <br />
      E-Mail:{' '}
      <a
        href={`mailto:${contact.email}`}
        className="text-primary underline-offset-4 hover:underline"
      >
        {contact.email}
      </a>
    </address>
  );
}
