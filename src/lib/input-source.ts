import { createReadStream } from "node:fs";

export const MAX_INPUT_BYTES = 16 * 1024 * 1024;

type InputStream = NodeJS.ReadableStream & { isTTY?: boolean };

/** Read literal UTF-8 text without shell interpolation or unbounded buffering. */
export async function readInputText(
  path: string,
  label: string,
  stdin: InputStream = process.stdin,
): Promise<string> {
  if (path === "-" && stdin.isTTY) {
    throw new Error(`${label}: stdin is interactive. Pipe input or supply a file path.`);
  }
  const stream = path === "-" ? stdin : createReadStream(path);
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream as AsyncIterable<Buffer | string>) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > MAX_INPUT_BYTES) {
        throw new Error(`${label} exceeds the 16 MiB input limit.`);
      }
      chunks.push(buffer);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("16 MiB input limit")) throw error;
    throw new Error(`Unable to read ${label} from ${path === "-" ? "stdin" : `file: ${path}`}.`);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    throw new Error(`${label} must contain valid UTF-8 text.`);
  }
  if (text.trim() === "") {
    throw new Error(`${label} must not be empty.`);
  }
  return text;
}

export async function resolveSqlInput(
  sql: string | undefined,
  file: string | undefined,
  fileFlag: string,
): Promise<string> {
  if (sql !== undefined && file !== undefined) {
    throw new Error(`SQL text and ${fileFlag} cannot be combined.`);
  }
  if (file !== undefined) return readInputText(file, "SQL input");
  if (sql === undefined || sql.trim() === "") {
    throw new Error(`SQL is required. Supply SQL text or ${fileFlag} <path|->.`);
  }
  return sql;
}

export function parseJsonObject(text: string, label: string): Record<string, any> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} must contain valid JSON.`);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, any>;
}

export async function readJsonInput(path: string, label: string): Promise<Record<string, any>> {
  return parseJsonObject(await readInputText(path, label), label);
}
