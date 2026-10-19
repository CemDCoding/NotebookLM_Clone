import { z } from 'zod';

// Machine-readable reasons so the web app never has to compare message text.
export const ErrorCode = {
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  NO_READY_SOURCES: 'NO_READY_SOURCES',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_FILE: 'UNSUPPORTED_FILE',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorCodeSchema = z.enum(ErrorCode);

export const ErrorResponseSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  error: z.string().min(1),
  message: z.string().min(1),
  code: ErrorCodeSchema.optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
