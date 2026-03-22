import { apiRequest } from "../../lib/api-client";
import type { PageResponse } from "../subscriptions/types";
import type { ScraperSource, ScraperSourceCreateInput, ScraperSourceUpdateInput } from "./types";

const basePath = "/api/v1/scraper/sources";

type ApiScraperSource = ScraperSource;

export type ListScraperSourcesInput = {
  limit?: number;
  offset?: number;
};

export async function listScraperSources(input: ListScraperSourcesInput = {}): Promise<PageResponse<ScraperSource>> {
  const query = new URLSearchParams({
    limit: String(input.limit ?? 100),
    offset: String(input.offset ?? 0),
  });

  const data = await apiRequest<PageResponse<ApiScraperSource>>(`${basePath}?${query.toString()}`);
  return data;
}

export async function createScraperSource(input: ScraperSourceCreateInput): Promise<ScraperSource> {
  const data = await apiRequest<ApiScraperSource>(basePath, {
    method: "POST",
    body: input,
  });
  return data;
}

export async function updateScraperSource(id: string, input: ScraperSourceUpdateInput): Promise<ScraperSource> {
  const data = await apiRequest<ApiScraperSource>(`${basePath}/${id}`, {
    method: "PATCH",
    body: input,
  });
  return data;
}

export async function deleteScraperSource(id: string): Promise<void> {
  await apiRequest<void>(`${basePath}/${id}`, {
    method: "DELETE",
  });
}
