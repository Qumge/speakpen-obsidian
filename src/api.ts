import { requestUrl } from "obsidian";
import { APIIdea, IdeasResponse } from "./types";

const BASE_URL = "https://speakpen.app/api/v1";

export class SpeakPenAPI {
  constructor(private token: string, private isCurrent: () => boolean = () => true) {}

  private checkCurrent() {
    if (!this.isCurrent()) throw new Error("Sync session changed");
  }

  async fetchOwnerId(): Promise<string> {
    this.checkCurrent();
    const response = await requestUrl({
      url: `${BASE_URL}/me`, method: "GET",
      headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
    });
    this.checkCurrent();
    const id: unknown = response.json?.data?.id;
    if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
      throw new Error("Could not verify SpeakPen account");
    }
    return id;
  }

  /**
   * @param updatedSince ISO8601 cursor. When given, the server returns only notes
   *   changed at or after it, ordered oldest-change-first. Omitted on a first sync.
   */
  async fetchIdeasPage(page: number, updatedSince?: string | null): Promise<IdeasResponse> {
    const params = [`page=${page}`, "per_page=50"];
    if (updatedSince) {
      params.push(`updated_since=${encodeURIComponent(updatedSince)}`);
    }

    this.checkCurrent();
    try {
      const response = await requestUrl({
        url: `${BASE_URL}/ideas?${params.join("&")}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
      });
      this.checkCurrent();
      return response.json as IdeasResponse;
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      if (err?.status === 401) {
        throw new Error("Invalid API token");
      }
      throw new Error("Could not fetch notes. Check your connection and try again.");
    }
  }

  /**
   * Every note changed at or after `updatedSince`, across all pages.
   *
   * Passing a cursor is what keeps a routine sync cheap: without one this walks the
   * user's entire history every run, which for a large vault is dozens of requests
   * every few minutes to learn that nothing happened.
   */
  async fetchIdeasSince(updatedSince: string | null): Promise<APIIdea[]> {
    const allIdeas: APIIdea[] = [];
    let page = 1;

    while (true) {
      const response = await this.fetchIdeasPage(page, updatedSince);
      allIdeas.push(...response.data);

      const nextPage = response.meta.next_page;
      if (nextPage === null) {
        break;
      }

      // The cursor has to move forward. A next_page that repeats or goes backwards
      // would otherwise loop here indefinitely, growing allIdeas without bound and
      // leaving isSyncing stuck true so no later sync could start.
      if (nextPage <= page) {
        throw new Error(`Pagination did not advance past page ${page}`);
      }
      page = nextPage;
    }

    return allIdeas;
  }
}
