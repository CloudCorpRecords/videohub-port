#!/usr/bin/env node
/**
 * videohub-port CLI.
 *   videohub-port <tool-name> '<json args>'
 *   videohub-port mcp
 * Requires YOUTUBE_API_KEY. Exit codes: 0 success, 1 error, 2 usage.
 */
import { apiBaseFromEnv, apiKeyFromEnv, callTool, timedtextBaseFromEnv, VERSION } from "./youtube.js";
import type { FetchFn } from "./types.js";

const TOOL_NAMES = [
  "search_videos", "get_video", "list_video_comments", "get_channel",
  "search_channels", "list_playlists", "get_playlist", "list_playlist_items",
  "get_video_transcript", "list_channel_videos", "get_video_categories",
  "get_trending_videos",
];

function usage(): never {
  console.error(`Usage:
  videohub-port <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  videohub-port mcp
  videohub-port --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    const out = await callTool(fetchFn, apiKeyFromEnv(), apiBaseFromEnv(), cmd, args, timedtextBaseFromEnv());
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
