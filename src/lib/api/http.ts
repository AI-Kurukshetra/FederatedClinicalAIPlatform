export function getPagination(searchParams: URLSearchParams, defaultLimit = 20, maxLimit = 100) {
  const limitParam = Number(searchParams.get('limit') ?? defaultLimit);
  const offsetParam = Number(searchParams.get('offset') ?? 0);

  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), maxLimit) : defaultLimit;
  const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

  return { limit, offset };
}
