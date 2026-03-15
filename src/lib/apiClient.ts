type JsonValue = unknown;

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return requestJson<T>(url, { method: "GET" });
}

export function apiPost<T>(url: string, body: JsonValue): Promise<T> {
  return requestJson<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function apiPatch<T>(url: string, body: JsonValue): Promise<T> {
  return requestJson<T>(url, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete<T>(url: string): Promise<T> {
  return requestJson<T>(url, { method: "DELETE" });
}