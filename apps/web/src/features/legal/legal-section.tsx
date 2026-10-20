import type { ReactNode } from 'react';

interface LegalSectionProps {
  title: string;
  children: ReactNode;
}

export function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
