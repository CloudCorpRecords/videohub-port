# videohub-port — BUILD REPORT

Original: youtube (community YouTube MCP servers) → Rebuild: videohub-port
Tier C core subset. Local only, nothing pushed or published.

## Scope
12 tools against the YouTube Data API v3
(https://www.googleapis.com/youtube/v3, base overridable via
YOUTUBE_API_BASE_URL), TOKEN/KEY-ENV ONLY: YOUTUBE_API_KEY sent
as the `key` query parameter on every Data API request, with
`Accept: application/json` and no Authorization header, all
HTTP behind an injectable FetchFn:
search_videos (GET /search?part=snippet&type=video&q&maxResults&order),
get_video (GET /videos?part=snippet,statistics,contentDetails&id),
list_video_comments (GET /commentThreads?part=snippet&videoId&maxResults),
get_channel (GET /channels?part=snippet,statistics&id),
search_channels (GET /search?part=snippet&type=channel&q&maxResults),
list_playlists (GET /playlists?part=snippet&channelId&maxResults),
get_playlist (GET /playlists?part=snippet&id),
list_playlist_items (GET /playlistItems?part=snippet,contentDetails&playlistId&maxResults),
get_video_transcript (see below),
list_channel_videos (GET /search?part=snippet&type=video&channelId&order=date&maxResults),
get_video_categories (GET /videoCategories?part=snippet&regionCode, default US),
get_trending_videos (GET /videos?part=snippet,statistics&chart=mostPopular&regionCode&maxResults, region default US).
max_results maps to the maxResults query param and is omitted
when undefined; query-string values are URL-encoded with part
commas left literal.

Transcript simplification: get_video_transcript is NOT a Data
API call. It GETs the public timedtext endpoint
(https://www.youtube.com/api/timedtext, base overridable via
YOUTUBE_TIMEDTEXT_BASE_URL) as ?v&lang&fmt=json3 with no key
parameter through the same FetchFn, and parses the json3 events
into plain text (each event's segs' utf8 strings joined, a
newline between events, trimmed). An empty or non-JSON response
returns an honest "no caption track available..." error —
transcript text is never invented. Labelled simplified: it
picks the requested language track directly, with no
caption-track listing/selection.

Omitted groups (fixture `_source` lists them): OAuth flow and
all writes (uploads, playlist create/edit, subscriptions,
likes/ratings, comments posting), my-channel/subscriptions
reads requiring OAuth, live streaming, video
insert/update/delete, channel sections/branding, i18n depth
beyond categories/trending region, analytics API, captions
download in srt/vtt formats and caption-track listing.

Ground truth: schemas are docs-derived from the public YouTube
Data API v3 documentation (developers.google.com/youtube/v3)
plus the public timedtext endpoint shape for transcripts.
Fixture: harness/fixtures/youtube-tools-original.json
(labelled core-subset). Community YouTube MCP originals vary;
the originals' OAuth flow is NOT reproduced — this is a
key-env REST client for the same public reads, with no write
tools.

## Verified (foreground, from disk)
- Tools: 12/12 — parity.json identical_tools = 12 = total.
- Unit tests: 16/16 pass (fake FetchFn; missing-key error
  naming YOUTUBE_API_KEY, base overrides/trim for both bases,
  URL incl. part params + key + maxResults mapping + US region
  defaults for every Data tool, search query encoding,
  transcript json3 parsing into text over a multi-event
  fixture, transcript empty/non-JSON honest error, transcript
  URL carrying no key param, no Authorization header, upstream
  error surfacing with the Data API error payload message).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0; unknown command exits 2 with Usage.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct
  100.0 (parity-out/parity.json).
- Missing-env checks: CLI search_videos with YOUTUBE_API_KEY
  unset → "error: YOUTUBE_API_KEY environment variable is
  required", exit 1; stdio tools/call search_videos with the
  key unset returned isError "YOUTUBE_API_KEY environment
  variable is required".
- server.json description 75 chars (≤100); OCI entry has no
  version field; npm entry carries version 0.1.0; Dockerfile
  label io.github.CloudCorpRecords/videohub-port; full
  19-file factory set present.

## Honest gaps
- No live YouTube call was made — request/response behaviour
  is fake-fetch proven only.
- The transcript tool is the simplified json3 timedtext path
  only: no caption-track listing/selection, no srt/vtt formats,
  and videos without a track in the requested language return
  the honest no-caption error rather than falling back.
- Lockfile is a copied fleet lockfile with identity fields
  edited — clean lockfile regeneration is REQUIRED before
  publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
- The OAuth surface of the community originals is not
  reproduced (see Scope); there are no write tools at all.
