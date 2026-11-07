import { afterEach, describe, expect, it } from "vitest";
import { handleDbSchema } from "../../src/commands/db/schema.js";
import { getFetchCalls, mockFetch, resetMock } from "../helpers/mock-server.js";

const identity = { host: "https://metadata.invalid", token: "mb_fixture" };
const metadata = {
  id: 1, name: "Analytics", engine: "postgres", details: { password: "never-emit" },
  tables: [
    { id: 10, name: "orders", schema: "public", description: "Orders", fields: [
      { id: 101, name: "id", database_type: "bigint", semantic_type: "type/PK" },
      { id: 102, name: "customer_id", database_type: "bigint", semantic_type: "type/FK", fk_target_field_id: 201, values: ["do-not-emit"] },
      { id: 103, name: "hidden_ref", base_type: "type/Integer", fk_target_field_id: 999 },
    ] },
    { id: 20, name: "customers", schema: "public", fields: [
      { id: 201, name: "id", database_type: "bigint", semantic_type: "type/PK", description: "Customer ID" },
    ] },
    { id: 30, name: "orders", schema: "archive" },
  ],
};

afterEach(resetMock);

describe("compact database schema", () => {
  it("resolves declared relationships in one request without emitting raw metadata", async () => {
    mockFetch([{ status: 200, body: metadata }]);
    const result = await handleDbSchema(1, { ...identity, tables: "public.orders" });
    expect(getFetchCalls()).toHaveLength(1);
    expect(result.engine).toBe("postgres");
    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].fields[0].primary_key).toBe(true);
    expect(result.tables[0].fields[1].foreign_key).toEqual({ field_id: 201, table_id: 20, schema: "public", table: "customers", field: "id" });
    expect(result.tables[0].fields[2].foreign_key).toEqual({ field_id: 999 });
    expect(JSON.stringify(result)).not.toMatch(/never-emit|do-not-emit/);
  });

  it("distinguishes metadata unavailable from a table with no declared fields", async () => {
    mockFetch([{ status: 200, body: metadata }]);
    const result = await handleDbSchema(1, { ...identity, tables: "30" });
    expect(result.tables[0]).toMatchObject({ fields_available: false, fields: [] });
  });

  it("rejects ambiguous names and allows schema disambiguation", async () => {
    mockFetch([{ status: 200, body: metadata }, { status: 200, body: metadata }]);
    await expect(handleDbSchema(1, { ...identity, tables: "orders" })).rejects.toThrow(/Ambiguous table/);
    const result = await handleDbSchema(1, { ...identity, schema: "public", tables: "orders,customers" });
    expect(result.tables.map((table) => table.id)).toEqual([10, 20]);
  });

  it("reports unknown tables and malformed payloads instead of claiming empty results", async () => {
    mockFetch([{ status: 200, body: metadata }, { status: 200, body: {} }]);
    await expect(handleDbSchema(1, { ...identity, tables: "missing" })).rejects.toThrow(/Unknown table/);
    await expect(handleDbSchema(1, identity)).rejects.toThrow(/invalid database metadata/);
  });

  it("rejects malformed selectors before requesting metadata", async () => {
    mockFetch([]);
    await expect(handleDbSchema(1, { ...identity, tables: "orders," })).rejects.toThrow(/--tables/);
    expect(getFetchCalls()).toHaveLength(0);
  });
});
