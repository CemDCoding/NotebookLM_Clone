import { describe, expect, it } from 'vitest';
import { getLegalContact } from './legal-contact';

const completeEnv = {
  IMPRESSUM_NAME: 'Erika Mustermann',
  IMPRESSUM_STREET: 'Musterstraße 1',
  IMPRESSUM_CITY: '12345 Musterstadt',
  IMPRESSUM_EMAIL: 'kontakt@example.com',
};

describe('getLegalContact', () => {
  it('returns the trimmed contact details when all variables are set', () => {
    expect(getLegalContact({ ...completeEnv, IMPRESSUM_NAME: '  Erika Mustermann ' })).toEqual({
      name: 'Erika Mustermann',
      street: 'Musterstraße 1',
      city: '12345 Musterstadt',
      email: 'kontakt@example.com',
    });
  });

  it('returns null outside a Vercel production build when variables are missing', () => {
    expect(getLegalContact({})).toBeNull();
    expect(getLegalContact({ VERCEL_ENV: 'preview' })).toBeNull();
  });

  it('treats blank values as missing', () => {
    expect(getLegalContact({ ...completeEnv, IMPRESSUM_STREET: '   ' })).toBeNull();
  });

  it('fails a Vercel production build and names the variables without their values', () => {
    const env = {
      ...completeEnv,
      IMPRESSUM_CITY: '',
      IMPRESSUM_EMAIL: 'no-address',
      VERCEL_ENV: 'production',
    };

    expect(() => getLegalContact(env)).toThrow(/IMPRESSUM_CITY, IMPRESSUM_EMAIL/);
    expect(() => getLegalContact(env)).not.toThrow(/no-address/);
  });
});
