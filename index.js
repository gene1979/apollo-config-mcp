import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import schema from './mcp/schema.json' with { type: 'json' };
import { getApolloConfigTool } from './mcp/tools/getApolloConfig.js';

function loadEnv() {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.join(currentDir, '.env');

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const index = trimmed.indexOf('=');
    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    let value = trimmed.slice(index + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnv();

const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL;
const serverInfo = schema.server ?? {
  name: 'apollo-config-mcp',
  version: '0.1.0',
};

if (!APOLLO_BASE_URL) {
  console.error('[apollo-config-mcp] Warning: APOLLO_BASE_URL is not set. Tool invocations will fail until it is configured.');
}

const tools = new Map();
tools.set(getApolloConfigTool.name, getApolloConfigTool);

function writeMessage(message) {
  const json = JSON.stringify(message);
  const payload = `Content-Length: ${Buffer.byteLength(json, 'utf8')}` + "\r\n\r\n" + json;
  process.stdout.write(payload);
}

function createResponse(id, result) {
  writeMessage({ jsonrpc: '2.0', id, result });
}

function createError(id, code, message, data) {
  writeMessage({
    jsonrpc: '2.0',
    id,
    error: {
      code,
      message,
      data,
    },
  });
}

let shutdownRequested = false;
let buffer = '';

function handleInitialize(id) {
  createResponse(id, {
    protocolVersion: '0.1',
    serverInfo,
    capabilities: {
      tools: {},
    },
  });
}

function handleToolsList(id) {
  const toolsForResponse = Array.from(tools.values()).map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  }));

  createResponse(id, {
    tools: toolsForResponse,
  });
}

async function handleToolsCall(id, params = {}) {
  const { name, arguments: args = {} } = params;

  if (!name) {
    createError(id, -32602, 'Missing tool name in request.');
    return;
  }

  const tool = tools.get(name);

  if (!tool) {
    createError(id, -32601, `Unknown tool: ${name}`);
    return;
  }

  try {
    const result = await tool.handler(args, { baseUrl: APOLLO_BASE_URL });
    createResponse(id, {
      content: [
        {
          type: 'json',
          json: result,
        },
      ],
    });
  } catch (error) {
    console.error(`[apollo-config-mcp] Tool ${name} failed`, error);
    createError(id, -32001, error.message || 'Tool execution failed.', error.details ?? undefined);
  }
}

function handlePing(id) {
  createResponse(id, {});
}

function handleShutdown(id) {
  shutdownRequested = true;
  createResponse(id, {});
}

function processMessage(message) {
  if (!message) {
    return;
  }

  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      handleInitialize(id);
      break;
    case 'tools/list':
      handleToolsList(id);
      break;
    case 'tools/call':
      handleToolsCall(id, params);
      break;
    case 'ping':
      handlePing(id);
      break;
    case 'shutdown':
      handleShutdown(id);
      break;
    case 'exit':
      process.exit(shutdownRequested ? 0 : 1);
      break;
    default:
      if (id !== undefined) {
        createError(id, -32601, `Method not found: ${method}`);
      }
  }
}

function tryParseMessages() {
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');

    if (headerEnd === -1) {
      break;
    }

    const header = buffer.slice(0, headerEnd);
    const lengthMatch = /Content-Length: (\d+)/i.exec(header);

    if (!lengthMatch) {
      buffer = buffer.slice(headerEnd + 4);
      continue;
    }

    const contentLength = Number.parseInt(lengthMatch[1], 10);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;

    if (buffer.length < messageEnd) {
      break;
    }

    const raw = buffer.slice(messageStart, messageEnd);
    buffer = buffer.slice(messageEnd);

    try {
      const parsed = JSON.parse(raw);
      processMessage(parsed);
    } catch (error) {
      console.error('[apollo-config-mcp] Failed to parse incoming message', error);
    }
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  tryParseMessages();
});

process.stdin.on('end', () => {
  if (!shutdownRequested) {
    process.exit(0);
  }
});

console.error('[apollo-config-mcp] MCP server ready on stdio.');
