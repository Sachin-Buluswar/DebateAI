import { z } from 'zod';

/**
 * Schema used in /api/wiki-search endpoint to validate request body
 */
export const wikiSearchRequestSchema = z.object({
  query: z.string().min(1, 'query cannot be empty'),
  maxResults: z.number().int().positive().optional(),
});

export type WikiSearchRequestBody = z.infer<typeof wikiSearchRequestSchema>;

export const debugQuerySchema = z.object({
  key: z.string().min(1),
  insert: z.enum(['true', 'false']).optional(),
  userId: z.string().optional(),
});

export type DebugQueryParams = z.infer<typeof debugQuerySchema>; 