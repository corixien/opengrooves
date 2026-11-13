import type { Groove, GrooveInput } from "../../shared/groove";
import { store } from "./storage";

export class ApiError extends Error {
  constructor(public status: number) {
    super(`HTTP ${status}`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", "x-client-id": store.getClientId(), ...init.headers },
  });
  if (!res.ok) throw new ApiError(res.status);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface ListFilters {
  q: string;
  tags: string[];
  focus: string[];
  difficulty: string;
  minBpm: string;
  maxBpm: string;
  minBars: string;
  maxBars: string;
  sort: "new" | "popular" | "played";
}

export interface FocusOption {
  id: string;
  de: string;
  en: string;
}

export interface ListResult {
  items: Groove[];
  total: number;
  pageSize: number;
}

export const api = {
  list(f: ListFilters, page: number) {
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.tags.length) p.set("tags", f.tags.join(","));
    if (f.focus.length) p.set("focus", f.focus.join(","));
    for (const k of ["difficulty", "minBpm", "maxBpm", "minBars", "maxBars"] as const) if (f[k]) p.set(k, f[k]);
    p.set("sort", f.sort);
    p.set("page", String(page));
    return request<ListResult>(`/grooves?${p}`);
  },
  options: () => request<{ focus: FocusOption[] }>("/options"),
  get: (id: string) => request<Groove>(`/grooves/${id}`),
  create: (g: GrooveInput) =>
    request<{ groove: Groove; token: string }>("/grooves", { method: "POST", body: JSON.stringify(g) }),
  update: (id: string, g: GrooveInput, token: string) =>
    request<Groove>(`/grooves/${id}`, { method: "PUT", body: JSON.stringify(g), headers: { "x-owner-token": token } }),
  requestDelete: (id: string, reason: string) => request<void>(`/grooves/${id}/delete-request`, { method: "POST", body: JSON.stringify({ reason }) }),
  remove: (id: string, token: string) =>
    request<void>(`/grooves/${id}`, { method: "DELETE", headers: { "x-owner-token": token } }),
  play: (id: string) => request<void>(`/grooves/${id}/play`, { method: "POST" }),
  like: (id: string, on: boolean) =>
    request<{ likes: number }>(`/grooves/${id}/like`, { method: on ? "PUT" : "DELETE" }),
  myLikes: () => request<string[]>("/likes/mine", { method: "POST" }),
};
