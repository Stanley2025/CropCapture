export const DROPPABLE_ON_FOREIGN_KEY: readonly string[];
export function describeError(message: string | null | undefined): { column: string; kind: 'missing_column' | 'foreign_key' } | null;
export function upsertDroppingMissingColumns(
  upsert: (rows: any[]) => PromiseLike<{ error: { message: string } | null | undefined }>,
  rows: any[],
  skip?: Set<string>,
  opts?: { maxAttempts?: number; droppableOnForeignKey?: readonly string[] }
): Promise<{ error: any; rows: any[]; dropped: string[] }>;
