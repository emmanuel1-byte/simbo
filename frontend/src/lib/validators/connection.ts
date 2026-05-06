import { z } from 'zod';

export const connectionSchema = z.object({
  provider: z.enum(['postgres', 'mysql', 'snowflake', 'bigquery', 'sqlite']),
  name: z.string().min(2, 'Give this connection a name.').max(60),
  host: z.string().min(1, 'Host is required.'),
  port: z
    .union([z.string().regex(/^\d+$/, 'Port must be a number.'), z.literal('')])
    .optional(),
  database: z.string().min(1, 'Database name is required.'),
  username: z.string().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
  ssl: z.boolean().default(true),
});

export type ConnectionValues = z.infer<typeof connectionSchema>;
