export async function readResponseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text.trim()) {
    return null;
  }
  return JSON.parse(text) as T;
}
