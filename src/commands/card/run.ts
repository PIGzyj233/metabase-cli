import { Command } from "commander";
import { createApiClient } from "../../lib/api-client.js";
import { output } from "../../lib/formatter.js";
import { unpackDatasetResult, type DatasetResult } from "../../lib/dataset-result.js";
import { resolveCommandOutputOptions } from "../../lib/output-options.js";
import { handleCommandError } from "../../lib/errors.js";
import type { GlobalOptions } from "../../types/index.js";

interface CardRunOptions extends GlobalOptions {
  params?: string;
  templateTags?: string;
  limit?: number;
  offset?: number;
}

async function resolveParameters(
  client: ReturnType<typeof createApiClient>,
  cardId: string | number,
  paramsJson: string
): Promise<any[]> {
  const userParams = JSON.parse(paramsJson);
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
  paramsJson: string
): Promise<any[]> {
  const userParams = JSON.parse(paramsJson);
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

export async function handleCardRun(
  cardId: string | number,
  opts: CardRunOptions
): Promise<DatasetResult> {
  const client = createApiClient(opts);

  let body: any = { ignore_cache: false };
  if (opts.params) {
    body.parameters = await resolveParameters(client, cardId, opts.params);
  } else if (opts.templateTags) {
    body.parameters = await resolveTemplateTags(client, cardId, opts.templateTags);
  }

  const res = await client.post(`/api/card/${cardId}/query`, body);

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
    .option("--template-tags <json>", "Template tag parameters as JSON key-value pairs (for native queries)")
    .option("--limit <n>", "Max rows (default: 100)", (v) => parseInt(v), 100)
    .option("--offset <n>", "Row offset", (v) => parseInt(v), 0)
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
