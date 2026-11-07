import { Command, Option } from "commander";
import { parsePositiveInteger, parseNonNegativeInteger, validatePagination } from "../../lib/input-validation.js";
import { readJsonInput } from "../../lib/input-source.js";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { unpackDatasetResult, type DatasetResult } from "../../lib/dataset-result.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
import { handleCommandError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

interface CardRunOptions extends GlobalOptions {
  params?: string;
  paramsFile?: string;
  templateTags?: string;
  templateTagsFile?: string;
  limit?: number;
  offset?: number;
}

async function resolveParameters(
  client: ReturnType<typeof createApiClient>,
  cardId: string | number,
  userParams: Record<string, unknown>
): Promise<any[]> {
  const card = await client.get(`/api/card/${cardId}`);
  const cardParams: any[] = card.parameters || [];

  const resolved: any[] = [];
  for (const [key, value] of Object.entries(userParams)) {
    const match = cardParams.find(
      (p: any) => p.slug === key || p.name === key
    );
    if (!match) {
      const available = cardParams.map((p: any) => p.slug || p.name).join(", ");
      throw new Error(
        `Unknown parameter "${key}". Available parameters: ${available || "(none)"}`
      );
    }
    resolved.push({
      id: match.id,
      type: match.type,
      target: match.target,
      value,
    });
  }

  return resolved;
}

async function resolveTemplateTags(
  client: ReturnType<typeof createApiClient>,
  cardId: string | number,
  userParams: Record<string, unknown>
): Promise<any[]> {
  const card = await client.get(`/api/card/${cardId}`);
  const tags: Record<string, any> =
    card.dataset_query?.native?.["template-tags"] || {};

  const resolved: any[] = [];
  for (const [key, value] of Object.entries(userParams)) {
    const tag = tags[key];
    if (!tag) {
      const available = Object.keys(tags).join(", ");
      throw new Error(
        `Unknown template tag "${key}". Available tags: ${available || "(none)"}`
      );
    }
    const isDimension = tag.type === "dimension";
    const paramType = tag["widget-type"] || tag.type;
    const target: any = isDimension
      ? ["dimension", ["template-tag", key]]
      : ["variable", ["template-tag", key]];
    const paramValue = isDimension && !Array.isArray(value) ? [value] : value;

    resolved.push({
      type: paramType,
      target,
      value: paramValue,
      ...(tag.id ? { id: tag.id } : {}),
    });
  }

  return resolved;
}

function parseParameterObject(raw: string, flag: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error(`${flag} must contain valid JSON.`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${flag} must be a JSON object of parameter names and values.`);
  }
  return value as Record<string, unknown>;
}

export async function handleCardRun(
  cardId: string | number,
  opts: CardRunOptions
): Promise<DatasetResult> {
  const parsedCardId = parsePositiveInteger(cardId, "Card ID");
  validatePagination(opts);
  const hasParams = opts.params !== undefined || opts.paramsFile !== undefined;
  const hasTemplateTags = opts.templateTags !== undefined || opts.templateTagsFile !== undefined;
  if (hasParams && hasTemplateTags) {
    throw new Error("--params and --template-tags cannot be combined (including their file variants).");
  }
  if (opts.params !== undefined && opts.paramsFile !== undefined) {
    throw new Error("--params and --params-file cannot be combined.");
  }
  if (opts.templateTags !== undefined && opts.templateTagsFile !== undefined) {
    throw new Error("--template-tags and --template-tags-file cannot be combined.");
  }
  const params = opts.paramsFile !== undefined
    ? await readJsonInput(opts.paramsFile, "Parameter JSON input")
    : opts.params === undefined ? undefined : parseParameterObject(opts.params, "--params");
  const templateTags = opts.templateTagsFile !== undefined
    ? await readJsonInput(opts.templateTagsFile, "Template tag JSON input")
    : opts.templateTags === undefined ? undefined : parseParameterObject(opts.templateTags, "--template-tags");
  const client = createApiClient(opts);

  let body: any = { ignore_cache: false };
  if (params) {
    body.parameters = await resolveParameters(client, parsedCardId, params);
  } else if (templateTags) {
    body.parameters = await resolveTemplateTags(client, parsedCardId, templateTags);
  }

  const res = await client.post(`/api/card/${parsedCardId}/query`, body);

  return unpackDatasetResult(res, {
    limit: opts.limit,
    offset: opts.offset,
    failureMessage: "Card query execution failed",
  });
}

export function registerCardRunCommand(parent: Command): void {
  parent
    .command("run <card-id>")
    .description("Execute a saved card/question")
    .option("--params <json>", "Parameters as JSON key-value pairs")
    .addOption(new Option("--params-file <path>", "Read parameter JSON from a file, or - for stdin").conflicts("params"))
    .addOption(new Option("--template-tags <json>", "Template tag parameters as JSON key-value pairs (for native queries)")
      .conflicts(["params", "paramsFile"]))
    .addOption(new Option("--template-tags-file <path>", "Read template tag JSON from a file, or - for stdin")
      .conflicts(["params", "paramsFile", "templateTags"]))
    .option("--limit <n>", "Max rows to display from the response (local slice)", (v) => parsePositiveInteger(v, "Limit"), 100)
    .option("--offset <n>", "Rows to skip locally; each invocation submits the query again", (v) => parseNonNegativeInteger(v, "Offset"), 0)
    .action(async function (this: Command, cardId: string) {
      const opts = this.optsWithGlobals();
      try {
        const result = await handleCardRun(cardId, opts);
        output(result.data, resolveCommandOutputOptions(opts, {
          pagination: result.pagination,
        }));
      } catch (e: any) {
        handleCommandError(e, opts);
      }
    });
}
