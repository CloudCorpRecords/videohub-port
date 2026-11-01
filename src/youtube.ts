/**
 * videohub-port core: a 12-tool core subset of the YouTube MCP
 * server surface, implemented clean-room against the public
 * YouTube Data API v3 (https://www.googleapis.com/youtube/v3,
 * base overridable via YOUTUBE_API_BASE_URL).
 *
 * Auth: TOKEN/KEY-ENV ONLY. YOUTUBE_API_KEY, sent as the `key`
 * query parameter on every Data API request, with
 * `Accept: application/json` and no Authorization header. A
 * missing key is an error naming the variable. All HTTP goes
 * through an injected FetchFn so the wire behaviour is fully
 * testable offline.
 *
 * Transcripts are NOT a Data API call: they use the public
 * timedtext endpoint (base overridable via
 * YOUTUBE_TIMEDTEXT_BASE_URL, default
 * https://www.youtube.com/api/timedtext) with fmt=json3 and no
 * key parameter. Simplified: the requested language track is
 * picked directly, with no caption-track listing/selection.
 *
 * Note: community YouTube MCP originals vary and commonly use an
 * OAuth flow (for uploads, subscriptions writes and my-channel
 * management); that OAuth flow is NOT reproduced — no write
 * tools are included in this subset.
 */
import type {
  FetchFn,
  GetChannelOptions,
  GetPlaylistOptions,
  GetTrendingVideosOptions,
  GetVideoCategoriesOptions,
  GetVideoOptions,
  GetVideoTranscriptOptions,
  ListChannelVideosOptions,
  ListPlaylistItemsOptions,
  ListPlaylistsOptions,
  ListVideoCommentsOptions,
  SearchChannelsOptions,
  SearchVideosOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DEFAULT_API_BASE = "https://www.googleapis.com/youtube/v3";
export const DEFAULT_TIMEDTEXT_BASE = "https://www.youtube.com/api/timedtext";

export function apiKeyFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.YOUTUBE_API_KEY;
  const key = typeof raw === "string" ? raw.trim() : "";
  if (!key) throw new Error("YOUTUBE_API_KEY environment variable is required");
  return key;
}

export function apiBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.YOUTUBE_API_BASE_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function timedtextBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.YOUTUBE_TIMEDTEXT_BASE_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_TIMEDTEXT_BASE).replace(/\/+$/, "");
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      // URL-encode values, but keep part-list commas literal.
      const encoded = encodeURIComponent(String(value)).replace(/%2C/g, ",");
      parts.push(`${encodeURIComponent(key)}=${encoded}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

async function apiRequest(fetchFn: FetchFn, apiKey: string, base: string, path: string): Promise<unknown> {
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetchFn(`${base}${path}${separator}key=${encodeURIComponent(apiKey)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      const message = parsed.error?.message;
      if (typeof message === "string") detail = message;
    } catch { /* keep raw */ }
    throw new Error(`YouTube API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

export async function searchVideos(fetchFn: FetchFn, apiKey: string, base: string, opts: SearchVideosOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/search${query({ part: "snippet", type: "video", q: opts.query, maxResults: opts.max_results, order: opts.order })}`);
}
export async function getVideo(fetchFn: FetchFn, apiKey: string, base: string, opts: GetVideoOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/videos${query({ part: "snippet,statistics,contentDetails", id: opts.video_id })}`);
}
export async function listVideoComments(fetchFn: FetchFn, apiKey: string, base: string, opts: ListVideoCommentsOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/commentThreads${query({ part: "snippet", videoId: opts.video_id, maxResults: opts.max_results })}`);
}
export async function getChannel(fetchFn: FetchFn, apiKey: string, base: string, opts: GetChannelOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/channels${query({ part: "snippet,statistics", id: opts.channel_id })}`);
}
export async function searchChannels(fetchFn: FetchFn, apiKey: string, base: string, opts: SearchChannelsOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/search${query({ part: "snippet", type: "channel", q: opts.query, maxResults: opts.max_results })}`);
}
export async function listPlaylists(fetchFn: FetchFn, apiKey: string, base: string, opts: ListPlaylistsOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/playlists${query({ part: "snippet", channelId: opts.channel_id, maxResults: opts.max_results })}`);
}
export async function getPlaylist(fetchFn: FetchFn, apiKey: string, base: string, opts: GetPlaylistOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/playlists${query({ part: "snippet", id: opts.playlist_id })}`);
}
export async function listPlaylistItems(fetchFn: FetchFn, apiKey: string, base: string, opts: ListPlaylistItemsOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/playlistItems${query({ part: "snippet,contentDetails", playlistId: opts.playlist_id, maxResults: opts.max_results })}`);
}

interface TimedTextEvent { segs?: Array<{ utf8?: string }> }

export async function getVideoTranscript(fetchFn: FetchFn, timedtextBase: string, opts: GetVideoTranscriptOptions): Promise<string> {
  const language = opts.language ?? "en";
  const url = `${timedtextBase}${query({ v: opts.video_id, lang: language, fmt: "json3" })}`;
  const res = await fetchFn(url, { method: "GET", headers: { Accept: "application/json" } });
  const text = await res.text();
  const noCaption = () => new Error(`no caption track available for video ${opts.video_id} in language ${language}`);
  if (!res.ok || !text.trim()) throw noCaption();
  let parsed: { events?: TimedTextEvent[] };
  try {
    parsed = JSON.parse(text) as { events?: TimedTextEvent[] };
  } catch {
    throw noCaption();
  }
  if (!Array.isArray(parsed.events)) throw noCaption();
  const lines: string[] = [];
  for (const event of parsed.events) {
    if (!Array.isArray(event.segs)) continue;
    lines.push(event.segs.map((seg) => seg.utf8 ?? "").join(""));
  }
  const transcript = lines.join("\n").trim();
  if (!transcript) throw noCaption();
  return transcript;
}

export async function listChannelVideos(fetchFn: FetchFn, apiKey: string, base: string, opts: ListChannelVideosOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/search${query({ part: "snippet", type: "video", channelId: opts.channel_id, order: "date", maxResults: opts.max_results })}`);
}
export async function getVideoCategories(fetchFn: FetchFn, apiKey: string, base: string, opts: GetVideoCategoriesOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/videoCategories${query({ part: "snippet", regionCode: opts.region_code ?? "US" })}`);
}
export async function getTrendingVideos(fetchFn: FetchFn, apiKey: string, base: string, opts: GetTrendingVideosOptions): Promise<unknown> {
  return apiRequest(fetchFn, apiKey, base, `/videos${query({ part: "snippet,statistics", chart: "mostPopular", regionCode: opts.region_code ?? "US", maxResults: opts.max_results })}`);
}

export async function callTool(
  fetchFn: FetchFn,
  apiKey: string,
  base: string,
  name: string,
  args: Record<string, unknown>,
  timedtextBase: string = DEFAULT_TIMEDTEXT_BASE,
): Promise<unknown> {
  switch (name) {
    case "search_videos": return searchVideos(fetchFn, apiKey, base, args as unknown as SearchVideosOptions);
    case "get_video": return getVideo(fetchFn, apiKey, base, args as unknown as GetVideoOptions);
    case "list_video_comments": return listVideoComments(fetchFn, apiKey, base, args as unknown as ListVideoCommentsOptions);
    case "get_channel": return getChannel(fetchFn, apiKey, base, args as unknown as GetChannelOptions);
    case "search_channels": return searchChannels(fetchFn, apiKey, base, args as unknown as SearchChannelsOptions);
    case "list_playlists": return listPlaylists(fetchFn, apiKey, base, args as unknown as ListPlaylistsOptions);
    case "get_playlist": return getPlaylist(fetchFn, apiKey, base, args as unknown as GetPlaylistOptions);
    case "list_playlist_items": return listPlaylistItems(fetchFn, apiKey, base, args as unknown as ListPlaylistItemsOptions);
    case "get_video_transcript": return getVideoTranscript(fetchFn, timedtextBase, args as unknown as GetVideoTranscriptOptions);
    case "list_channel_videos": return listChannelVideos(fetchFn, apiKey, base, args as unknown as ListChannelVideosOptions);
    case "get_video_categories": return getVideoCategories(fetchFn, apiKey, base, args as unknown as GetVideoCategoriesOptions);
    case "get_trending_videos": return getTrendingVideos(fetchFn, apiKey, base, args as unknown as GetTrendingVideosOptions);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
