import { inspect } from "util";

import { debugStdio } from "./constants.js";
import { ValidationError } from "./types.js";

// Utility functions

export function debugLog(category: string, message: string, data?: unknown): void {
  if (!debugStdio) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${category}] ${message}`;
  console.error(logMessage);
  if (data !== undefined) {
    console.error("  DATA:", inspect(data, { depth: 3, colors: true }));
  }
}

type ToolErrorResponse = {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
};

export function handleToolError(error: unknown): ToolErrorResponse {
  debugLog("ERROR", "Tool execution failed", error);

  if (error instanceof ValidationError) {
    const errorMessage = error.details !== undefined && error.details !== ''
      ? `${error.message}\n\nDetails: ${error.details}`
      : error.message;

    return {
      content: [
        {
          type: "text" as const,
          text: `Validation Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}