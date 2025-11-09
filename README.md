# apollo-config-mcp

Minimal Claude MCP server for [Apollo Config Service](https://github.com/apolloconfig/apollo).

The project exposes the Apollo Config HTTP API as a Claude MCP tool so Claude Code / Codex can load
configuration namespaces directly from Apollo without running an extra HTTP proxy.

## Features

- Implements a lightweight MCP server over stdio (no local web server required)
- Provides a `getApolloConfig` tool that wraps Apollo's `GET /configs/{appId}/{cluster}/{namespace}` endpoint
- Supports environment-based configuration via `.env` or explicit MCP server environment variables
- Simple in-memory response cache with a 60 second TTL for repeated lookups

## Getting started

### Prerequisites

- Node.js 18 or newer
- `pnpm` (or any Node package manager — examples below use `pnpm`)

### Installation

```bash
pnpm install
```

### Configuration

Copy `.env.example` to `.env` and set the Apollo Config base URL, or provide the variable directly in your MCP configuration:

```bash
cp .env.example .env
# Edit .env to point to your Apollo Config Service
```

Required variables:

- `APOLLO_BASE_URL` – Base URL of your Apollo Config Service instance (e.g. `http://apollo-configservice.company.com`)

### Running the MCP server locally

```bash
pnpm start
```

The process will wait for MCP messages on stdin/stdout. When running manually you can stop it with `Ctrl+C`.

### Adding to Claude Code

Add an entry to your `claude_desktop_config.json` (or the equivalent configuration file in Claude Code) pointing to the project directory:

```json
{
  "mcpServers": {
    "apollo-config": {
      "command": "node",
      "args": ["index.js"],
      "cwd": "/absolute/path/to/apollo-config-mcp",
      "env": {
        "APOLLO_BASE_URL": "http://apollo-configservice.company.com"
      }
    }
  }
}
```

Alternatively, you can rely on a `.env` file in the project directory and omit the `env` block.

Once configured, reload Claude Code and it will detect the `getApolloConfig` tool.

### Example tool invocation

Inside Claude Code (after adding the MCP server), run:

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
