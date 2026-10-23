import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@notebooklm/shared';
import { DomainError } from '../common/errors';

/**
 * The notebook has no active source with status `ready`. Checked before the
 * limits and before any model call, so the question costs neither quota nor
 * money (PE-30).
 */
export class NoReadySourcesError extends DomainError {
  constructor() {
    super(
      HttpStatus.CONFLICT,
      ErrorCode.NO_READY_SOURCES,
      'Dieses Notebook hat keine aktive, fertig verarbeitete Quelle. Füge eine Quelle hinzu oder aktiviere eine, um Fragen zu stellen.',
    );
  }
}
