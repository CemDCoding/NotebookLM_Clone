import { CreateNotebookRequestSchema, NOTEBOOK_TITLE_MAX_LENGTH } from '@notebooklm/shared';

export type TitleValidation = { success: true; title: string } | { success: false; error: string };

/** Checks a title with the shared contract, so browser and API accept exactly the same titles. */
export function validateNotebookTitle(rawTitle: string): TitleValidation {
  const result = CreateNotebookRequestSchema.shape.title.safeParse(rawTitle);
  if (result.success) {
    return { success: true, title: result.data };
  }
  const tooLong = result.error.issues.some((issue) => issue.code === 'too_big');
  return {
    success: false,
    error: tooLong
      ? `Der Titel darf höchstens ${NOTEBOOK_TITLE_MAX_LENGTH} Zeichen lang sein.`
      : 'Bitte gib einen Titel ein.',
  };
}
