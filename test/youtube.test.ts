import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiBaseFromEnv,
  apiKeyFromEnv,
  getChannel,
  getPlaylist,
  getTrendingVideos,
  getVideo,
  getVideoCategories,
  getVideoTranscript,
  listChannelVideos,
  listPlaylistItems,
  listPlaylists,
  listVideoComments,
  searchChannels,
  searchVideos,
  timedtextBaseFromEnv,
} from "../src/youtube.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded { url: string; method: string; headers: Record<string, string>; body: unknown; }

function fakeFetch(steps: Array<{ match: string; payload: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText ?? JSON.stringify(step.payload),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://www.googleapis.com/youtube/v3";
const TIMEDTEXT = "https://www.youtube.com/api/timedtext";
const KEY = "test-key-123";

describe("videohub-port core", () => {
  it("names the env var when the API key is missing", () => {
    assert.throws(() => apiKeyFromEnv({}), /YOUTUBE_API_KEY environment variable is required/);
    assert.equal(apiKeyFromEnv({ YOUTUBE_API_KEY: " k " }), "k");
  });

  it("applies base overrides and trims trailing slashes for both bases", () => {
    assert.equal(apiBaseFromEnv({}), "https://www.googleapis.com/youtube/v3");
    assert.equal(apiBaseFromEnv({ YOUTUBE_API_BASE_URL: "https://example.test/v3/" }), "https://example.test/v3");
    assert.equal(timedtextBaseFromEnv({}), "https://www.youtube.com/api/timedtext");
    assert.equal(timedtextBaseFromEnv({ YOUTUBE_TIMEDTEXT_BASE_URL: "https://example.test/timedtext///" }), "https://example.test/timedtext");
  });

  it("search_videos gets /search with part, type, key, maxResults and order, encoding the query", async () => {
    const { fn, calls } = fakeFetch([{ match: "/search", payload: { items: [] } }]);
    await searchVideos(fn, KEY, BASE, { query: "lo fi & beats", max_results: 5, order: "viewCount" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=lo%20fi%20%26%20beats&maxResults=5&order=viewCount&key=test-key-123");
    assert.equal(calls[0].headers.Accept, "application/json");
    assert.equal(calls[0].headers.Authorization, undefined);
    await searchVideos(fn, KEY, BASE, { query: "x" });
    assert.equal(calls[1].url, "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=x&key=test-key-123");
  });

  it("get_video gets /videos with snippet,statistics,contentDetails parts (literal commas)", async () => {
    const { fn, calls } = fakeFetch([{ match: "/videos", payload: { items: [{ id: "v1" }] } }]);
    await getVideo(fn, KEY, BASE, { video_id: "v1" });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=v1&key=test-key-123");
  });

  it("list_video_comments gets /commentThreads with maxResults mapping", async () => {
    const { fn, calls } = fakeFetch([{ match: "/commentThreads", payload: { items: [] } }]);
    await listVideoComments(fn, KEY, BASE, { video_id: "v1", max_results: 7 });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=v1&maxResults=7&key=test-key-123");
    await listVideoComments(fn, KEY, BASE, { video_id: "v1" });
    assert.equal(calls[1].url, "https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=v1&key=test-key-123");
  });

  it("get_channel gets /channels with snippet,statistics parts", async () => {
    const { fn, calls } = fakeFetch([{ match: "/channels", payload: { items: [] } }]);
    await getChannel(fn, KEY, BASE, { channel_id: "UC1" });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=UC1&key=test-key-123");
  });

  it("search_channels gets /search with type=channel", async () => {
    const { fn, calls } = fakeFetch([{ match: "/search", payload: { items: [] } }]);
    await searchChannels(fn, KEY, BASE, { query: "music", max_results: 3 });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=music&maxResults=3&key=test-key-123");
  });

  it("list_playlists and get_playlist hit /playlists paths", async () => {
    const { fn, calls } = fakeFetch([{ match: "/playlists", payload: { items: [] } }]);
    await listPlaylists(fn, KEY, BASE, { channel_id: "UC1", max_results: 9 });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId=UC1&maxResults=9&key=test-key-123");
    await getPlaylist(fn, KEY, BASE, { playlist_id: "PL1" });
    assert.equal(calls[1].url, "https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=PL1&key=test-key-123");
  });

  it("list_playlist_items gets /playlistItems with snippet,contentDetails parts", async () => {
    const { fn, calls } = fakeFetch([{ match: "/playlistItems", payload: { items: [] } }]);
    await listPlaylistItems(fn, KEY, BASE, { playlist_id: "PL1", max_results: 4 });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=PL1&maxResults=4&key=test-key-123");
  });

  it("get_video_transcript parses json3 events into plain text with no key param", async () => {
    const payload = {
      events: [
        { segs: [{ utf8: "Hello " }, { utf8: "world" }] },
        { segs: [{ utf8: "second line" }] },
        { tStartMs: 1000 },
      ],
    };
    const { fn, calls } = fakeFetch([{ match: "timedtext", payload }]);
    const out = await getVideoTranscript(fn, TIMEDTEXT, { video_id: "v1" });
    assert.equal(out, "Hello world\nsecond line");
    assert.equal(calls[0].url, "https://www.youtube.com/api/timedtext?v=v1&lang=en&fmt=json3");
    assert.ok(!calls[0].url.includes("key="));
    assert.equal(calls[0].headers.Authorization, undefined);
  });

  it("get_video_transcript honours an explicit language", async () => {
    const payload = { events: [{ segs: [{ utf8: "Hola" }] }] };
    const { fn, calls } = fakeFetch([{ match: "timedtext", payload }]);
    const out = await getVideoTranscript(fn, TIMEDTEXT, { video_id: "v1", language: "es" });
    assert.equal(out, "Hola");
    assert.equal(calls[0].url, "https://www.youtube.com/api/timedtext?v=v1&lang=es&fmt=json3");
  });

  it("get_video_transcript returns an honest error on an empty or non-JSON response", async () => {
    const empty = fakeFetch([{ match: "timedtext", payload: null, rawText: "" }]);
    await assert.rejects(() => getVideoTranscript(empty.fn, TIMEDTEXT, { video_id: "v1" }), /no caption track available/);
    const html = fakeFetch([{ match: "timedtext", payload: null, rawText: "<html>nope</html>" }]);
    await assert.rejects(() => getVideoTranscript(html.fn, TIMEDTEXT, { video_id: "v1" }), /no caption track available/);
  });

  it("list_channel_videos gets /search with channelId and order=date", async () => {
    const { fn, calls } = fakeFetch([{ match: "/search", payload: { items: [] } }]);
    await listChannelVideos(fn, KEY, BASE, { channel_id: "UC1", max_results: 6 });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&channelId=UC1&order=date&maxResults=6&key=test-key-123");
  });

  it("get_video_categories defaults regionCode to US and honours overrides", async () => {
    const { fn, calls } = fakeFetch([{ match: "/videoCategories", payload: { items: [] } }]);
    await getVideoCategories(fn, KEY, BASE, {});
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=US&key=test-key-123");
    await getVideoCategories(fn, KEY, BASE, { region_code: "GB" });
    assert.equal(calls[1].url, "https://www.googleapis.com/youtube/v3/videoCategories?part=snippet&regionCode=GB&key=test-key-123");
  });

  it("get_trending_videos gets /videos with chart=mostPopular and US default", async () => {
    const { fn, calls } = fakeFetch([{ match: "/videos", payload: { items: [] } }]);
    await getTrendingVideos(fn, KEY, BASE, { max_results: 8 });
    assert.equal(calls[0].url, "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=8&key=test-key-123");
    await getTrendingVideos(fn, KEY, BASE, { region_code: "JP" });
    assert.equal(calls[1].url, "https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=JP&key=test-key-123");
  });

  it("surfaces upstream error status and the Data API error message", async () => {
    const { fn } = fakeFetch([{ match: "/videos", payload: { error: { code: 403, message: "quota exceeded" } }, status: 403 }]);
    await assert.rejects(() => getVideo(fn, KEY, BASE, { video_id: "v1" }), /YouTube API error 403: quota exceeded/);
  });
});
