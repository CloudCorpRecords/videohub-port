# videohub-port

YouTube videos, channels and playlists as MCP tools, talking to
the YouTube Data API v3. videohub-port is a clean-room rebuild of
the core surface of the community YouTube MCP servers, under a
new name: fresh code, no copied branding.

Auth model: TOKEN/KEY-ENV ONLY. Public reads use the YouTube
Data API v3 with `YOUTUBE_API_KEY` sent as the `key` query
parameter. The community originals' OAuth flow (for uploads,
subscriptions writes and my-channel management) is NOT
reproduced — there are no write tools in this subset.

## Tools (core subset, 12)

`search_videos`, `get_video`, `list_video_comments`,
`get_channel`, `search_channels`, `list_playlists`,
`get_playlist`, `list_playlist_items`, `get_video_transcript`,
`list_channel_videos`, `get_video_categories`,
`get_trending_videos`.

The transcript tool is simplified: it is not a Data API call. It
fetches the public timedtext endpoint with `fmt=json3` for the
requested language track directly (no caption-track
listing/selection, no key parameter) and joins the json3 events
into plain text; when no track is available it returns an honest
"no caption track available" error and never invents text.

Not in this subset: the OAuth flow and all writes (uploads,
playlist create/edit, subscriptions, likes/ratings, comments
posting), my-channel/subscriptions reads requiring OAuth, live
streaming, video insert/update/delete, channel
sections/branding, i18n depth beyond categories/trending
region, the analytics API, and captions download in srt/vtt
formats or caption-track listing.

## Setup

Create an API key in the Google Cloud console (YouTube Data API
v3 enabled) and set it:

```bash
export YOUTUBE_API_KEY=AIza...
```

Optionally override the API base with `YOUTUBE_API_BASE_URL`
(default `https://www.googleapis.com/youtube/v3`) and the
transcript base with `YOUTUBE_TIMEDTEXT_BASE_URL` (default
`https://www.youtube.com/api/timedtext`). Every Data API request
carries `Accept: application/json` and the key as the `key`
query parameter (no Authorization header). Without the key,
every tool call fails with an error naming the missing
variable.

## CLI

```bash
npx @reneturcios/videohub-port search_videos '{"query":"lo fi"}'
npx @reneturcios/videohub-port mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "videohub-port": {
      "command": "npx",
      "args": ["-y", "@reneturcios/videohub-port", "mcp"],
      "env": { "YOUTUBE_API_KEY": "AIza..." }
    }
  }
}
```

## Docker

```bash
docker run -i -e YOUTUBE_API_KEY ghcr.io/cloudcorprecords/videohub-port
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
