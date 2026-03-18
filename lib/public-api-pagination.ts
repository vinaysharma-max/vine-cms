export const DEFAULT_PUBLIC_API_LIMIT = 20;
export const MAX_PUBLIC_API_LIMIT = 100;

export type PublicApiCursorPagination = {
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export function toPublicApiCursorPagination(args: {
  limit: number;
  continueCursor: string;
  isDone: boolean;
}) {
  return {
    limit: args.limit,
    nextCursor: args.isDone ? null : args.continueCursor,
    hasMore: !args.isDone,
  } satisfies PublicApiCursorPagination;
}
