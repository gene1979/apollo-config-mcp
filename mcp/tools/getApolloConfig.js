const CACHE_TTL_MS = 60_000;
const cache = new Map();

function createCacheKey(appId, cluster, namespace) {
  return `${appId}::${cluster}::${namespace}`;
}

async function fetchConfig(baseUrl, appId, cluster, namespace) {
  if (!baseUrl) {
    const error = new Error('APOLLO_BASE_URL is not configured.');
    error.statusCode = 500;
    throw error;
  }

  const endpoint = new URL(
    `/configs/${encodeURIComponent(appId)}/${encodeURIComponent(cluster)}/${encodeURIComponent(namespace)}`,
    baseUrl,
  );

  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = new Error(`Apollo Config Service responded with status ${response.status}`);
    error.statusCode = response.status;
    try {
      error.details = await response.json();
    } catch (err) {
      error.details = await response.text();
    }
    throw error;
  }

  return response.json();
}

export const getApolloConfigTool = {
  name: 'getApolloConfig',
  description: 'Fetch configuration data from Apollo Config Service for the given appId, cluster, and namespace.',
  inputSchema: {
    type: 'object',
    required: ['appId', 'cluster', 'namespace'],
    properties: {
      appId: {
        type: 'string',
        description: 'Apollo application ID.',
      },
      cluster: {
        type: 'string',
        description: 'Apollo cluster name (often "default").',
      },
      namespace: {
        type: 'string',
        description: 'Apollo namespace name (e.g., "application").',
      },
    },
  },
  async handler(args, context) {
    const { appId, cluster, namespace } = args ?? {};

    if (!appId || !cluster || !namespace) {
      const error = new Error('Missing required arguments: appId, cluster, namespace are required.');
      error.statusCode = 400;
      throw error;
    }

    const key = createCacheKey(appId, cluster, namespace);
    const now = Date.now();
    const cached = cache.get(key);

    if (cached && cached.expiresAt > now) {
      return {
        source: 'cache',
        data: cached.data,
      };
    }

    const data = await fetchConfig(context.baseUrl, appId, cluster, namespace);

    cache.set(key, {
      data,
      expiresAt: now + CACHE_TTL_MS,
    });

    return {
      source: 'apollo',
      data,
    };
  },
};
