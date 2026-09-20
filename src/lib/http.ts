/** parse a JSON request body, returning null instead of throwing on bad input
    (callers answer with a 400 rather than a 500) */
export async function readJsonBody<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
