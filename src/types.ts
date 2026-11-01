/**
 * videohub-port types.
 *
 * A core subset of the YouTube MCP surface: videos, channels,
 * playlists, comments, categories, trending and transcripts against
 * the YouTube Data API v3 (plus the public timedtext endpoint for
 * transcripts). HTTP access is described by a minimal response
 * surface so tests can inject a fake fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface SearchVideosOptions { query: string; max_results?: number; order?: string; }
export interface GetVideoOptions { video_id: string; }
export interface ListVideoCommentsOptions { video_id: string; max_results?: number; }
export interface GetChannelOptions { channel_id: string; }
export interface SearchChannelsOptions { query: string; max_results?: number; }
export interface ListPlaylistsOptions { channel_id: string; max_results?: number; }
export interface GetPlaylistOptions { playlist_id: string; }
export interface ListPlaylistItemsOptions { playlist_id: string; max_results?: number; }
export interface GetVideoTranscriptOptions { video_id: string; language?: string; }
export interface ListChannelVideosOptions { channel_id: string; max_results?: number; }
export interface GetVideoCategoriesOptions { region_code?: string; }
export interface GetTrendingVideosOptions { region_code?: string; max_results?: number; }
