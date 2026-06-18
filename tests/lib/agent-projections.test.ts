import { describe, expect, it } from "vitest";
import {
  projectCardDetail,
  projectCardSummary,
  projectCollectionItem,
  projectCollectionSummary,
  projectDatabase,
  projectField,
  projectSchema,
  projectSearchResult,
  projectTable,
} from "../../src/lib/agent-projections.js";

describe("agent-projections", () => {
  it("projects databases", () => {
    const result = projectDatabase({
      id: 1,
      name: "Production",
      engine: "postgres",
      details: {},
    });

    expect(result).toEqual({
      id: 1,
      name: "Production",
      engine: "postgres",
    });
  });

  it("projects schemas", () => {
    expect(projectSchema("analytics")).toEqual({ schema: "analytics" });
  });

  it("projects tables", () => {
    const result = projectTable({
      id: 10,
      name: "orders",
      schema: "public",
      fields: [],
    });

    expect(result).toEqual({
      id: 10,
      name: "orders",
      schema: "public",
    });
  });

  it("projects fields with null missing descriptions", () => {
    const result = projectField({
      id: 2,
      name: "name",
      database_type: "varchar",
    });

    expect(result).toEqual({
      id: 2,
      name: "name",
      database_type: "varchar",
      description: null,
    });
  });

  it("projects card summaries with stable collection_id key", () => {
    const result = projectCardSummary({
      id: 42,
      name: "Revenue",
    });

    expect(result).toEqual({
      id: 42,
      name: "Revenue",
      collection_id: undefined,
    });
    expect(Object.keys(result)).toEqual(["id", "name", "collection_id"]);
  });

  it("projects card details with parameters and template tags", () => {
    const result = projectCardDetail({
      id: 42,
      name: "Revenue Report",
      description: "Monthly revenue",
      dataset_query: {
        type: "native",
        native: {
          query: "SELECT * FROM orders WHERE {{status}} AND name = {{name}}",
          "template-tags": {
            status: {
              "display-name": "Status",
              type: "dimension",
              "widget-type": "category",
            },
            name: {
              type: "text",
            },
          },
        },
      },
      parameters: [
        {
          id: "ignored",
          slug: "start_date",
          name: "Start Date",
          type: "date/single",
        },
      ],
    });

    expect(result).toEqual({
      id: 42,
      name: "Revenue Report",
      description: "Monthly revenue",
      query_type: "native",
      query: "SELECT * FROM orders WHERE {{status}} AND name = {{name}}",
      parameters: [
        {
          slug: "start_date",
          name: "Start Date",
          type: "date/single",
        },
      ],
      template_tags: [
        {
          name: "status",
          display_name: "Status",
          type: "dimension",
          widget_type: "category",
        },
        {
          name: "name",
          display_name: undefined,
          type: "text",
          widget_type: null,
        },
      ],
    });
  });

  it("projects collection summaries", () => {
    expect(
      projectCollectionSummary({
        id: 1,
        name: "Analytics",
        location: "/",
        parent_id: null,
      }),
    ).toEqual({
      id: 1,
      name: "Analytics",
      location: "/",
    });
  });

  it("projects collection items", () => {
    expect(
      projectCollectionItem({
        id: 42,
        name: "Revenue",
        model: "card",
        collection_id: 1,
      }),
    ).toEqual({
      id: 42,
      name: "Revenue",
      model: "card",
    });
  });

  it("projects search results with stable collection_id key", () => {
    const result = projectSearchResult({
      id: 42,
      name: "Revenue",
      model: "card",
    });

    expect(result).toEqual({
      id: 42,
      name: "Revenue",
      model: "card",
      collection_id: undefined,
    });
    expect(Object.keys(result)).toEqual(["id", "name", "model", "collection_id"]);
  });
});
