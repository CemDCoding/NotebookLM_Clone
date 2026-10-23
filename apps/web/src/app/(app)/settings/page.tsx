import type { Metadata } from 'next';
import { SettingsView } from '@/features/account/settings-view';

export const metadata: Metadata = {
  title: 'Einstellungen',
};

export default function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Deine <span className="font-serif font-normal italic">Einstellungen</span>
      </h1>
      <SettingsView />
    </div>
  );
}
