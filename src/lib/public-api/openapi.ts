import { z } from "zod";
import {
  publicApiBandSchema,
  publicApiEventDetailSchema,
  publicApiEventSummarySchema,
  publicApiPaginationSchema,
  publicApiProblemSchema,
  publicApiSongSchema,
} from "./schemas";

function schemaFor(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema);
  delete jsonSchema.$schema;
  return jsonSchema;
}

const jsonResponse = (schema: object, description = "Successful response") => ({
  description,
  content: {
    "application/json": { schema },
  },
});

const problemResponses = {
  "400": {
    description: "Invalid request parameter",
    content: {
      "application/problem+json": {
        schema: { $ref: "#/components/schemas/Problem" },
      },
    },
  },
  "404": {
    description: "Resource not found",
    content: {
      "application/problem+json": {
        schema: { $ref: "#/components/schemas/Problem" },
      },
    },
  },
  "500": {
    description: "Internal server error",
    content: {
      "application/problem+json": {
        schema: { $ref: "#/components/schemas/Problem" },
      },
    },
  },
};

const corsOptions = {
  summary: "CORS preflight",
  responses: { "204": { description: "Preflight accepted" } },
};

const limitParameter = {
  name: "limit",
  in: "query",
  description: "Page size. Defaults to 500 and cannot exceed 1000.",
  schema: { type: "integer", minimum: 1, maximum: 1000, default: 500 },
};

const cursorParameter = {
  name: "cursor",
  in: "query",
  description: "Opaque cursor returned by the preceding response.",
  schema: { type: "string" },
};

export const publicApiOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "BanG Dream! Events to Songs Open API",
    version: "1.0.0",
    description:
      "Read-only public data for BanG Dream! bands, songs, events, and setlists. The service is provided as-is without an availability SLA.",
  },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Bands" },
    { name: "Songs" },
    { name: "Events" },
  ],
  paths: {
    "/bands": {
      get: {
        tags: ["Bands"],
        summary: "List bands",
        responses: {
          "200": jsonResponse({
            type: "object",
            required: ["data"],
            properties: {
              data: {
                type: "array",
                items: { $ref: "#/components/schemas/Band" },
              },
            },
          }),
        },
      },
      options: corsOptions,
    },
    "/bands/{slug}": {
      get: {
        tags: ["Bands"],
        summary: "Get one band",
        parameters: [
          {
            name: "slug",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": jsonResponse({
            type: "object",
            required: ["data"],
            properties: {
              data: { $ref: "#/components/schemas/Band" },
            },
          }),
          ...problemResponses,
        },
      },
      options: corsOptions,
    },
    "/songs": {
      get: {
        tags: ["Songs"],
        summary: "List and search songs",
        parameters: [
          limitParameter,
          cursorParameter,
          {
            name: "q",
            in: "query",
            description: "Case-insensitive title substring.",
            schema: { type: "string", maxLength: 100 },
          },
          {
            name: "category",
            in: "query",
            schema: {
              type: "string",
              enum: ["original", "cover", "project-common"],
            },
          },
          { name: "band", in: "query", schema: { type: "string" } },
          {
            name: "sort",
            in: "query",
            schema: {
              type: "string",
              enum: ["id", "releaseDate", "title"],
              default: "id",
            },
          },
          {
            name: "order",
            in: "query",
            schema: {
              type: "string",
              enum: ["asc", "desc"],
              default: "asc",
            },
          },
        ],
        responses: {
          "200": jsonResponse({
            $ref: "#/components/schemas/SongListResponse",
          }),
          ...problemResponses,
        },
      },
      options: corsOptions,
    },
    "/songs/{id}": {
      get: {
        tags: ["Songs"],
        summary: "Get one song",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
        ],
        responses: {
          "200": jsonResponse({
            type: "object",
            required: ["data"],
            properties: {
              data: { $ref: "#/components/schemas/Song" },
            },
          }),
          ...problemResponses,
        },
      },
      options: corsOptions,
    },
    "/songs/{id}/events": {
      get: {
        tags: ["Songs", "Events"],
        summary: "List events where a song was performed",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
        ],
        responses: {
          "200": jsonResponse({
            type: "object",
            required: ["data"],
            properties: {
              data: {
                type: "array",
                items: { $ref: "#/components/schemas/EventSummary" },
              },
            },
          }),
          ...problemResponses,
        },
      },
      options: corsOptions,
    },
    "/events": {
      get: {
        tags: ["Events"],
        summary: "List and search events with setlists",
        parameters: [
          limitParameter,
          cursorParameter,
          {
            name: "q",
            in: "query",
            description: "Case-insensitive title substring.",
            schema: { type: "string", maxLength: 100 },
          },
          { name: "band", in: "query", schema: { type: "string" } },
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          {
            name: "setlistStatus",
            in: "query",
            schema: {
              type: "string",
              enum: ["missing", "partial", "complete"],
            },
          },
          {
            name: "order",
            in: "query",
            schema: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
          },
        ],
        responses: {
          "200": jsonResponse({
            $ref: "#/components/schemas/EventListResponse",
          }),
          ...problemResponses,
        },
      },
      options: corsOptions,
    },
    "/events/{eventernoteEventId}": {
      get: {
        tags: ["Events"],
        summary: "Get an event and its ordered setlist",
        parameters: [
          {
            name: "eventernoteEventId",
            in: "path",
            required: true,
            schema: { type: "integer", minimum: 1 },
          },
        ],
        responses: {
          "200": jsonResponse({
            type: "object",
            required: ["data"],
            properties: {
              data: { $ref: "#/components/schemas/EventDetail" },
            },
          }),
          ...problemResponses,
        },
      },
      options: corsOptions,
    },
  },
  components: {
    schemas: {
      Band: schemaFor(publicApiBandSchema),
      Song: schemaFor(publicApiSongSchema),
      EventSummary: schemaFor(publicApiEventSummarySchema),
      EventDetail: schemaFor(publicApiEventDetailSchema),
      Pagination: schemaFor(publicApiPaginationSchema),
      Problem: schemaFor(publicApiProblemSchema),
      SongListResponse: {
        type: "object",
        required: ["data", "pagination"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Song" },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
      EventListResponse: {
        type: "object",
        required: ["data", "pagination"],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/EventSummary" },
          },
          pagination: { $ref: "#/components/schemas/Pagination" },
        },
      },
    },
  },
} as const;
