import { z } from "zod";

import { executeQuery } from "./api.js";
import {
  predefinedDateRanges,
  validMetrics,
  eventDimensions,
  visitDimensions,
  timeDimensions,
  filterOperators,
  logicalOperators,
  behavioralOperators,
} from "./constants.js";
import { validateAllParameters } from "./validation.js";

import type { PlausibleQuery, PlausibleApiResponse } from "./types.js";

// Zod schemas for validation
const dimensionSchema = z.union([
  z.enum(eventDimensions),
  z.enum(visitDimensions),
  z.enum(timeDimensions),
  z.string(),
]);

const simpleFilterSchema = z.tuple([
  z.string(),
  z.enum(filterOperators),
  z.union([z.string(), z.array(z.string())]),
]);

const logicalFilterSchema: z.ZodType = z.lazy(() =>
  z.tuple([
    z.enum(logicalOperators),
    z.array(z.union([simpleFilterSchema, logicalFilterSchema, behavioralFilterSchema])),
  ])
);

const behavioralFilterSchema = z.tuple([
  z.enum(behavioralOperators),
  z.union([z.literal("goal"), z.literal("page")]),
  z.string(),
]);

const filterSchema = z.union([
  simpleFilterSchema,
  logicalFilterSchema,
  behavioralFilterSchema,
]);

const dateRangeSchema = z
  .union([
    z.enum(predefinedDateRanges).describe("Predefined date range"),
    z.tuple([z.string(), z.string()]).describe("Custom date range [start_date, end_date] in ISO8601"),
  ])
  .describe(`Date range to query. Either a predefined range (${predefinedDateRanges.join(", ")}) or custom date range as [start_date, end_date] in ISO8601 format`);

const metricsSchema = z
  .array(z.enum(validMetrics))
  .min(1)
  .describe("List of metrics to query");

const queryParamsSchema = z.object({
  site_id: z.string().describe("Domain of the site in Plausible"),
  metrics: metricsSchema,
  date_range: dateRangeSchema,
  dimensions: z
    .array(dimensionSchema)
    .optional()
    .describe("Dimensions to group by"),
  filters: z
    .array(filterSchema)
    .optional()
    .describe("Filters to apply"),
  order_by: z
    .array(z.tuple([z.string(), z.enum(["asc", "desc"])]))
    .optional()
    .describe("Sort order for results"),
  include: z
    .object({
      imports: z.boolean().optional().describe("Include imported data"),
      time_labels: z.boolean().optional().describe("Include time labels for time dimensions"),
      total_rows: z.boolean().optional().describe("Include total row count"),
    })
    .optional()
    .describe("Additional data to include"),
  pagination: z
    .object({
      limit: z.number().min(1).max(10000).optional().describe("Number of results (max 10000)"),
      offset: z.number().min(0).optional().describe("Number of results to skip"),
    })
    .optional()
    .describe("Pagination options"),
});

const aggregateParamsSchema = z.object({
  site_id: z.string().describe("Domain of the site in Plausible"),
  metrics: metricsSchema,
  date_range: dateRangeSchema,
  filters: z
    .array(filterSchema)
    .optional()
    .describe("Filters to apply"),
});

const breakdownParamsSchema = z.object({
  site_id: z.string().describe("Domain of the site in Plausible"),
  metrics: metricsSchema,
  date_range: dateRangeSchema,
  dimensions: z
    .array(dimensionSchema)
    .min(1)
    .describe("Dimensions to group by (at least one required)"),
  filters: z
    .array(filterSchema)
    .optional()
    .describe("Filters to apply"),
  limit: z
    .number()
    .min(1)
    .max(10000)
    .optional()
    .describe("Maximum number of result rows (max 10000)"),
});

const timeseriesParamsSchema = z.object({
  site_id: z.string().describe("Domain of the site in Plausible"),
  metrics: metricsSchema,
  date_range: dateRangeSchema,
  interval: z
    .enum(timeDimensions)
    .describe("Time bucket for the series (time, time:hour, time:day, time:week, time:month)"),
  filters: z
    .array(filterSchema)
    .optional()
    .describe("Filters to apply"),
});

type AggregateParams = z.infer<typeof aggregateParamsSchema>;
type BreakdownParams = z.infer<typeof breakdownParamsSchema>;
type TimeseriesParams = z.infer<typeof timeseriesParamsSchema>;

export class PlausibleClient {
  async query(params: PlausibleQuery): Promise<PlausibleApiResponse> {
    validateAllParameters(params);
    return executeQuery(params);
  }

  async aggregate(params: AggregateParams): Promise<PlausibleApiResponse> {
    return this.query(params as PlausibleQuery);
  }

  async breakdown(params: BreakdownParams): Promise<PlausibleApiResponse> {
    const { limit, ...rest } = params;
    return this.query({
      ...(rest as PlausibleQuery),
      ...(limit !== undefined ? { pagination: { limit } } : {}),
    });
  }

  async timeseries(params: TimeseriesParams): Promise<PlausibleApiResponse> {
    const { interval, ...rest } = params;
    return this.query({
      ...(rest as PlausibleQuery),
      dimensions: [interval],
    });
  }

  getSchema(): z.ZodRawShape {
    return queryParamsSchema.shape;
  }

  getAggregateSchema(): z.ZodRawShape {
    return aggregateParamsSchema.shape;
  }

  getBreakdownSchema(): z.ZodRawShape {
    return breakdownParamsSchema.shape;
  }

  getTimeseriesSchema(): z.ZodRawShape {
    return timeseriesParamsSchema.shape;
  }
}