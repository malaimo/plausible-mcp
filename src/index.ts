#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { plausibleApiKey, debugStdio } from "./constants.js";
import { PlausibleClient } from "./plausible-client.js";
import { debugLog, handleToolError } from "./utils.js";

import type { PlausibleQuery, PlausibleApiResponse } from "./types.js";

if (plausibleApiKey === undefined || plausibleApiKey === "") {
  throw new Error("PLAUSIBLE_API_KEY environment variable is required");
}

type ToolSuccess = {
  content: Array<{ type: "text"; text: string }>;
};

function toolSuccess(result: PlausibleApiResponse): ToolSuccess {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function main(): Promise<void> {
  debugLog("MCP", "Starting Plausible MCP Server", {
    pid: process.pid,
    nodeVersion: process.version,
    debugEnabled: debugStdio
  });

  const server = new McpServer({
    name: "plausible-analytics",
    version: "1.0.0",
    description: "Query analytics data from Plausible Analytics"
  });

  const client = new PlausibleClient();

  server.registerTool(
    "plausible_query",
    {
      description: "Full-featured Plausible query with filters, dimensions, ordering and pagination",
      inputSchema: client.getSchema(),
    },
    async (args: unknown) => {
      debugLog("TOOL", "plausible_query called", args);
      try {
        const result = await client.query(args as PlausibleQuery);
        debugLog("TOOL", "plausible_query successful", {
          resultsCount: result.results.length,
          hasMetadata: Boolean(result.meta)
        });
        return toolSuccess(result);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "plausible_aggregate",
    {
      description: "Get simple aggregate stats without dimensions",
      inputSchema: client.getAggregateSchema(),
    },
    async (args: unknown) => {
      debugLog("TOOL", "plausible_aggregate called", args);
      try {
        const result = await client.aggregate(args as Parameters<typeof client.aggregate>[0]);
        debugLog("TOOL", "plausible_aggregate successful", {
          resultsCount: result.results.length
        });
        return toolSuccess(result);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "plausible_breakdown",
    {
      description: "Get stats broken down by one or more dimensions",
      inputSchema: client.getBreakdownSchema(),
    },
    async (args: unknown) => {
      debugLog("TOOL", "plausible_breakdown called", args);
      try {
        const result = await client.breakdown(args as Parameters<typeof client.breakdown>[0]);
        debugLog("TOOL", "plausible_breakdown successful", {
          resultsCount: result.results.length
        });
        return toolSuccess(result);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  server.registerTool(
    "plausible_timeseries",
    {
      description: "Get time-based data for charting (interval: time, time:hour, time:day, time:week, time:month)",
      inputSchema: client.getTimeseriesSchema(),
    },
    async (args: unknown) => {
      debugLog("TOOL", "plausible_timeseries called", args);
      try {
        const result = await client.timeseries(args as Parameters<typeof client.timeseries>[0]);
        debugLog("TOOL", "plausible_timeseries successful", {
          resultsCount: result.results.length
        });
        return toolSuccess(result);
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  if (debugStdio) {
    debugLog("LIFECYCLE", "Debug mode enabled");
  }

  const transport = new StdioServerTransport();

  debugLog("TRANSPORT", "Starting stdio transport");
  await server.connect(transport);

  console.error("Plausible MCP Server running on stdio");
}

main().catch((error: unknown) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
