# apollo-config-mcp

Minimal Claude MCP server for [Apollo Config Service](https://github.com/apolloconfig/apollo).

This service exposes the Apollo Config HTTP API as a Claude MCP tool so Claude Code / Codex can load
configuration namespaces directly from Apollo.

## Features

- Implements the Claude MCP HTTP interface (`/schema`, `/tools`, `/call`)
- Provides a `getApolloConfig` tool that wraps Apollo's `GET /configs/{appId}/{cluster}/{namespace}` endpoint
- Supports environment-based configuration via `.env`
- Simple in-memory response cache with a 60 second TTL for repeated lookups

## Getting started

### Prerequisites

- Node.js 18 or newer
- `pnpm` (or `npm`/`yarn`, but examples below use `pnpm`)

### Installation

```bash
pnpm install
```

### Configuration

Copy `.env.example` to `.env` and adjust the Apollo Config base URL:

```bash
cp .env.example .env
# Edit .env to point to your Apollo Config Service
```

Required variables:

- `APOLLO_BASE_URL` – Base URL of your Apollo Config Service instance (e.g. `http://apollo-configservice.company.com`)

Optional variables:

- `PORT` – Port for the MCP server (defaults to `3333`)

### Running the MCP server

```bash
pnpm start
```

You should see console output similar to:

```
[apollo-config-mcp] Server listening on port 3333
```

### MCP endpoints

- `GET /schema` – Returns the MCP schema definition
- `GET /tools` – Lists supported tools
- `POST /call` – Executes a tool (expects `{ "name": "toolName", "arguments": { ... } }`)

### Adding to Claude Code

1. Start the MCP server locally (`pnpm start`).
2. In Claude Code, open **Settings → MCP Servers**.
3. Add a new HTTP MCP server pointing to `http://localhost:3333` (or your configured port).
4. Claude Code will automatically load the schema and available tools.

### Example tool invocation

With the server running, Claude Code can invoke the tool via MCP:

```
getApolloConfig appId="my-app" cluster="default" namespace="application"
```

If the Apollo Config Service has data for that namespace, the MCP server returns the JSON configuration payload.

## Project structure

```
apollo-config-mcp/
├─ package.json
├─ index.js
├─ mcp/
│  ├─ tools/
│  │  └─ getApolloConfig.js
│  └─ schema.json
├─ .env.example
└─ README.md
```

## License

MIT
