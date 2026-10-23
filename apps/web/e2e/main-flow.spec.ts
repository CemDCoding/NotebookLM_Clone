import { expect, test, type Page } from '@playwright/test';

const SOURCE_READY_TIMEOUT_MS = 60_000;
const ANSWER_TIMEOUT_MS = 90_000;

function requireEnv(name: 'E2E_USER_EMAIL' | 'E2E_USER_PASSWORD'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Add it to apps/web/.env.local (see .env.example).`);
  }
  return value;
}

async function logIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('E-Mail-Adresse').fill(requireEnv('E2E_USER_EMAIL'));
  await page.getByLabel('Passwort').fill(requireEnv('E2E_USER_PASSWORD'));
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Deine Notebooks' })).toBeVisible();
}

async function deleteNotebook(page: Page, title: string): Promise<void> {
  await page.goto('/notebooks');
  await page.getByRole('button', { name: `Aktionen für „${title}“` }).click();
  await page.getByRole('menuitem', { name: 'Löschen' }).click();
  await page
    .getByRole('alertdialog', { name: 'Notebook löschen?' })
    .getByRole('button', { name: 'Löschen' })
    .click();
  await expect(page.getByRole('link', { name: title })).toBeHidden();
}

test('main flow: sign in, create notebook, add source, ask, check citation, delete notebook', async ({
  page,
}) => {
  // The demo account of the development project is shared, so everything the test creates carries
  // a unique name and is removed again, also when a step fails.
  const runId = Date.now().toString(36);
  const notebookTitle = `E2E-Notebook ${runId}`;
  const sourceTitle = `E2E-Quelle ${runId}`;
  let notebookExists = false;

  try {
    await logIn(page);

    await test.step('create a notebook', async () => {
      await page.getByRole('button', { name: 'Neues Notebook' }).click();
      const dialog = page.getByRole('dialog', { name: 'Neues Notebook' });
      await dialog.getByLabel('Titel').fill(notebookTitle);
      await dialog.getByRole('button', { name: 'Anlegen' }).click();
      notebookExists = true;
      await page.getByRole('link', { name: notebookTitle }).click();
      await expect(page.getByRole('heading', { level: 1, name: notebookTitle })).toBeVisible();
    });

    await test.step('paste a text source and wait until it is ready', async () => {
      await page.getByRole('button', { name: 'Quelle hinzufügen' }).click();
      const dialog = page.getByRole('dialog', { name: 'Quelle hinzufügen' });
      await dialog.getByRole('tab', { name: 'Text einfügen' }).click();
      await dialog.getByLabel('Titel').fill(sourceTitle);
      await dialog
        .getByLabel('Text', { exact: true })
        .fill(
          'Der Planet Zorbon wird von der Hauptstadt Quellburg aus regiert. ' +
            'Quellburg liegt am Fluss Marlen und hat etwa 400.000 Einwohner. ' +
            'Die Amtssprache auf Zorbon ist Deutsch.',
        );
      await dialog.getByRole('button', { name: 'Hinzufügen' }).click();

      const sourceItem = page.getByRole('listitem').filter({ hasText: sourceTitle });
      await expect(sourceItem.getByText('bereit')).toBeVisible({
        timeout: SOURCE_READY_TIMEOUT_MS,
      });
    });

    await test.step('ask a question and open the citation preview', async () => {
      await page
        .getByRole('textbox', { name: 'Frage' })
        .fill('Wie heißt die Hauptstadt von Zorbon?');
      await page.getByRole('button', { name: 'Frage senden' }).click();

      const citation = page.getByRole('button', { name: 'Zitat 1' });
      await expect(citation).toBeVisible({ timeout: ANSWER_TIMEOUT_MS });

      // The source title is shown in the source list; the preview adds a second, identical one.
      const sourceTitleText = page.getByText(sourceTitle, { exact: true });
      await expect(sourceTitleText).toHaveCount(1);
      await citation.hover();
      await expect(sourceTitleText).toHaveCount(2);
    });
  } finally {
    if (notebookExists) {
      await deleteNotebook(page, notebookTitle);
    }
  }
});
