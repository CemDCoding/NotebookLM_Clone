import { ExportSchema } from '@notebooklm/shared';
import { ApiError, apiFetchResponse } from '@/lib/api-client';

const INVALID_EXPORT_MESSAGE = 'Der Export konnte nicht gelesen werden. Bitte versuche es erneut.';

/** Name of the download. Built here because CORS does not expose the API's Content-Disposition. */
export function exportFileName(now: Date): string {
  return `quellenchat-export-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Fetches the export and returns it as a file. The body is validated and re-serialized, so
 * only fields known to `ExportSchema` end up in the download.
 */
export async function fetchExportFile(now = new Date()): Promise<{ name: string; blob: Blob }> {
  const response = await apiFetchResponse('/me/export');

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw new ApiError(response.status, INVALID_EXPORT_MESSAGE, undefined, { cause: error });
  }
  const parsed = ExportSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(response.status, INVALID_EXPORT_MESSAGE, undefined, {
      cause: parsed.error,
    });
  }

  const blob = new Blob([JSON.stringify(parsed.data, null, 2)], { type: 'application/json' });
  return { name: exportFileName(now), blob };
}

/** Hands the file to the browser's download; there is no other way to save a Blob client-side. */
export function saveFile({ name, blob }: { name: string; blob: Blob }): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
