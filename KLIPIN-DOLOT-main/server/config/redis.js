
const axios = require("axios");

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const isConfigured = Boolean(URL && TOKEN);

// ---- Fallback in-memory store ----
const mem = new Map();
const memLists = new Map();

function memGet(key) {
  return mem.has(key) ? mem.get(key) : null;
}
function memSet(key, value) {
  mem.set(key, value);
  return "OK";
}
function memIncr(key) {
  const cur = Number(mem.get(key) || 0) + 1;
  mem.set(key, cur);
  return cur;
}
function memLpush(key, value) {
  const list = memLists.get(key) || [];
  list.unshift(value);
  if (list.length > 500) list.length = 500;
  memLists.set(key, list);
  return list.length;
}
function memLrange(key, start, stop) {
  const list = memLists.get(key) || [];
  const end = stop === -1 ? list.length : stop + 1;
  return list.slice(start, end);
}

// ---- Upstash REST client ----
const client = axios.create({
  baseURL: URL,
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 5000,
});

async function upstash(cmd) {
  const { data } = await client.post("/", cmd);
  return data.result;
}

const redis = {
  configured: isConfigured,

  async get(key) {
    if (!isConfigured) return memGet(key);
    try {
      const val = await upstash(["GET", key]);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },

  async set(key, value) {
    if (!isConfigured) return memSet(key, value);
    try {
      return await upstash(["SET", key, JSON.stringify(value)]);
    } catch {
      return null;
    }
  },

  async incr(key) {
    if (!isConfigured) return memIncr(key);
    try {
      return await upstash(["INCR", key]);
    } catch {
      return 0;
    }
  },

  async lpush(key, value) {
    if (!isConfigured) return memLpush(key, JSON.stringify(value));
    try {
      return await upstash(["LPUSH", key, JSON.stringify(value)]);
    } catch {
      return 0;
    }
  },

  async lrange(key, start, stop) {
    if (!isConfigured) {
      return memLrange(key, start, stop).map((v) => JSON.parse(v));
    }
    try {
      const raw = await upstash(["LRANGE", key, start, stop]);
      return (raw || []).map((v) => JSON.parse(v));
    } catch {
      return [];
    }
  },

  async ltrim(key, start, stop) {
    if (!isConfigured) return "OK";
    try {
      return await upstash(["LTRIM", key, start, stop]);
    } catch {
      return null;
    }
  },
};

module.exports = redis;
