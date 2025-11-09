import express from 'express';
import dotenv from 'dotenv';
import { getApolloConfigTool } from './mcp/tools/getApolloConfig.js';
import schema from './mcp/schema.json' assert { type: 'json' };

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3333;
const APOLLO_BASE_URL = process.env.APOLLO_BASE_URL;

if (!APOLLO_BASE_URL) {
  console.warn('[apollo-config-mcp] APOLLO_BASE_URL is not set. Requests will fail until it is configured.');
}

app.use(express.json());

const tools = {
  [getApolloConfigTool.name]: getApolloConfigTool,
};

app.get('/', (_req, res) => {
  res.json({
    name: 'apollo-config-mcp',
    status: 'ok',
  });
});

app.get('/schema', (_req, res) => {
  res.json(schema);
});

app.get('/tools', (_req, res) => {
  res.json({ tools: schema.tools });
});

app.post('/call', async (req, res) => {
  const { name, arguments: args = {} } = req.body ?? {};

  if (!name) {
    res.status(400).json({ error: 'Missing tool name in request body.' });
    return;
  }

  const tool = tools[name];

  if (!tool) {
    res.status(404).json({ error: `Unknown tool: ${name}` });
    return;
  }

  try {
    const result = await tool.handler(args, { baseUrl: APOLLO_BASE_URL });
    res.json({ result });
  } catch (error) {
    console.error(`[apollo-config-mcp] Tool ${name} failed:`, error);
    const status = error.statusCode && Number.isInteger(error.statusCode) ? error.statusCode : 500;
    res.status(status).json({
      error: error.message ?? 'Tool execution failed.',
      details: error.details,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[apollo-config-mcp] Server listening on port ${PORT}`);
});
