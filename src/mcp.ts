/**
 * videohub-port MCP server. Core subset: 12 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiBaseFromEnv, apiKeyFromEnv, callTool, timedtextBaseFromEnv, VERSION } from "./youtube.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  search_videos: z.object({ query: z.string(), max_results: z.number().optional(), order: z.string().optional() }),
  get_video: z.object({ video_id: z.string() }),
  list_video_comments: z.object({ video_id: z.string(), max_results: z.number().optional() }),
  get_channel: z.object({ channel_id: z.string() }),
  search_channels: z.object({ query: z.string(), max_results: z.number().optional() }),
  list_playlists: z.object({ channel_id: z.string(), max_results: z.number().optional() }),
  get_playlist: z.object({ playlist_id: z.string() }),
  list_playlist_items: z.object({ playlist_id: z.string(), max_results: z.number().optional() }),
  get_video_transcript: z.object({ video_id: z.string(), language: z.string().optional() }),
  list_channel_videos: z.object({ channel_id: z.string(), max_results: z.number().optional() }),
  get_video_categories: z.object({ region_code: z.string().optional() }),
  get_trending_videos: z.object({ region_code: z.string().optional(), max_results: z.number().optional() }),
};

export const TOOLS = [
  {
    name: "search_videos",
    description: "Search YouTube videos matching a query.",
    inputSchema: { type: "object" as const, properties: { query: { type: "string", description: "Search query text matched against YouTube video titles and metadata." }, max_results: { type: "number", description: "Maximum number of videos to return." }, order: { type: "string", description: "Sort order for the search results, passed to the YouTube search API (for example relevance, date, or viewCount)." } }, required: ["query"] },
  },
  {
    name: "get_video",
    description: "Retrieve a single YouTube video by ID.",
    inputSchema: { type: "object" as const, properties: { video_id: { type: "string", description: "ID of the YouTube video to retrieve." } }, required: ["video_id"] },
  },
  {
    name: "list_video_comments",
    description: "List comments on a YouTube video.",
    inputSchema: { type: "object" as const, properties: { video_id: { type: "string", description: "ID of the YouTube video whose comments are listed." }, max_results: { type: "number", description: "Maximum number of comments to return." } }, required: ["video_id"] },
  },
  {
    name: "get_channel",
    description: "Retrieve a single YouTube channel by ID.",
    inputSchema: { type: "object" as const, properties: { channel_id: { type: "string", description: "ID of the YouTube channel to retrieve." } }, required: ["channel_id"] },
  },
  {
    name: "search_channels",
    description: "Search YouTube channels matching a query.",
    inputSchema: { type: "object" as const, properties: { query: { type: "string", description: "Search query text matched against YouTube channel names and metadata." }, max_results: { type: "number", description: "Maximum number of channels to return." } }, required: ["query"] },
  },
  {
    name: "list_playlists",
    description: "List playlists for a YouTube channel.",
    inputSchema: { type: "object" as const, properties: { channel_id: { type: "string", description: "ID of the YouTube channel whose playlists are listed." }, max_results: { type: "number", description: "Maximum number of playlists to return." } }, required: ["channel_id"] },
  },
  {
    name: "get_playlist",
    description: "Retrieve a single YouTube playlist by ID.",
    inputSchema: { type: "object" as const, properties: { playlist_id: { type: "string", description: "ID of the YouTube playlist to retrieve." } }, required: ["playlist_id"] },
  },
  {
    name: "list_playlist_items",
    description: "List items in a YouTube playlist.",
    inputSchema: { type: "object" as const, properties: { playlist_id: { type: "string", description: "ID of the YouTube playlist whose items are listed." }, max_results: { type: "number", description: "Maximum number of playlist items to return." } }, required: ["playlist_id"] },
  },
  {
    name: "get_video_transcript",
    description: "Get the transcript of a YouTube video.",
    inputSchema: { type: "object" as const, properties: { video_id: { type: "string", description: "ID of the YouTube video whose transcript is retrieved." }, language: { type: "string", description: "Language code of the caption track to retrieve; defaults to English (en)." } }, required: ["video_id"] },
  },
  {
    name: "list_channel_videos",
    description: "List videos from a YouTube channel, newest first.",
    inputSchema: { type: "object" as const, properties: { channel_id: { type: "string", description: "ID of the YouTube channel whose videos are listed." }, max_results: { type: "number", description: "Maximum number of videos to return." } }, required: ["channel_id"] },
  },
  {
    name: "get_video_categories",
    description: "List YouTube video categories for a region.",
    inputSchema: { type: "object" as const, properties: { region_code: { type: "string", description: "Region code (ISO country code) whose video categories are listed; defaults to US." } }, required: [] as string[] },
  },
  {
    name: "get_trending_videos",
    description: "List trending YouTube videos for a region.",
    inputSchema: { type: "object" as const, properties: { region_code: { type: "string", description: "Region code (ISO country code) whose trending videos are listed; defaults to US." }, max_results: { type: "number", description: "Maximum number of trending videos to return." } }, required: [] as string[] },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "videohub-port", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const apiKey = apiKeyFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, apiKey, apiBaseFromEnv(), name, parsed, timedtextBaseFromEnv()));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
