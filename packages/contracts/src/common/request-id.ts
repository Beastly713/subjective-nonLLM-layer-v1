import { z } from 'zod';

export const RequestIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/);

export type RequestId = z.infer<typeof RequestIdSchema>;
