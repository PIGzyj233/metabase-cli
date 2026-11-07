import { createReadStream } from "node:fs";
import { CliError } from "./cli-error.js";

export const MAX_INPUT_BYTES = 16 * 1024 * 1024;

type InputStream = NodeJS.ReadableStream & { isTTY?: boolean };

/** Read literal UTF-8 text without shell interpolation or unbounded buffering. */
export async function readInputText(
  path: string,
  label: string,
  stdin: InputStream = process.stdin,
): Promise<string> {
  if (path === "-" && stdin.isTTY) {
    throw new CliError("INVALID_INPUT", `${label}: stdin is interactive. Pipe input or supply a file path.`,
      "Pipe UTF-8 input into stdin or supply a readable file path.");
  }
  const stream = path === "-" ? stdin : createReadStream(path);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_INPUT_BYTES) {
        throw new CliError("INVALID_INPUT", `${label} exceeds the 16 MiB input limit.`,
          "Use an input file or stream no larger than 16 MiB.");
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError("INVALID_INPUT", `Unable to read ${label} from ${path === "-" ? "stdin" : `file: ${path}`}.`,
      "Check the file path and read permissions, or use - with piped input.");
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new CliError("INVALID_INPUT", `${label} must contain valid UTF-8 text.`,
      "Save the input as UTF-8 before retrying.");
  }
  if (text.trim() === "") {
    throw new CliError("INVALID_INPUT", `${label} must not be empty.`,
      "Provide non-empty SQL or JSON input.");
  }
  return text;
}

export async function resolveSqlInput(
  sql: string | undefined,
  file: string | undefined,
  fileFlag: string,
): Promise<string> {
  if (sql !== undefined && file !== undefined) {
    throw new CliError("INVALID_INPUT", `SQL text and ${fileFlag} cannot be combined.`,
      `Use exactly one of SQL text or ${fileFlag} <path|->.`);
  }
  if (file !== undefined) return readInputText(file, "SQL input");
  if (sql === undefined || sql.trim() === "") {
    throw new CliError("INVALID_INPUT", `SQL is required. Supply SQL text or ${fileFlag} <path|->.`,
      `Supply SQL text directly or use ${fileFlag} with a readable file path or - for stdin.`);
  }
  return sql;
}

export function parseJsonObject(text: string, label: string): Record<string, any> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new CliError("INVALID_INPUT", `${label} must contain valid JSON.`,
      "Provide valid JSON containing one object, without comments or trailing commas.");
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError("INVALID_INPUT", `${label} must be an object.`,
      "Provide a JSON object rather than an array, scalar, or null.");
  }
  return value as Record<string, any>;
}

export async function readJsonInput(path: string, label: string): Promise<Record<string, any>> {
  return parseJsonObject(await readInputText(path, label), label);
}
