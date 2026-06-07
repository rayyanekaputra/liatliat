import { serve, file, spawn } from "bun";
import { parse } from "toml";
import * as path from "path";
import * as http from "node:http";
import * as https from "node:https";

const CONFIG_PATH = path.join(import.meta.dir, "config.toml");
const DATA_PATH = path.join(import.meta.dir, "data.json");

let config: any = {};
let state: any = {
  stats: {},
  logs: [],
};

const MAX_HISTORY = 200;
const MAX_LOGS = 100;

function addLog(message: string, level = "info") {
  const timestamp = new Date().toISOString();
  state.logs.unshift({ timestamp, message, level });
  if (state.logs.length > MAX_LOGS) {
    state.logs.pop();
  }
}

async function loadConfig() {
  try {
    const text = await file(CONFIG_PATH).text();
    config = parse(text);
    addLog("Config loaded successfully.");
  } catch (e: any) {
    addLog(`Failed to load config: ${e.message}`, "error");
  }
}

async function loadState() {
  try {
    const f = file(DATA_PATH);
    if (await f.exists()) {
      const data = await f.json();
      state = data;
      addLog("Previous state restored from data.json.");
    }
  } catch (e: any) {
    addLog(`Failed to load state: ${e.message}`, "error");
  }
}

async function saveState() {
  try {
    await Bun.write(DATA_PATH, JSON.stringify(state, null, 2));
  } catch (e: any) {
    console.error("Failed to save state", e);
  }
}

async function runCommand(cmd: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (config.use_sudo) {
    cmd = ["sudo", ...cmd];
  }
  const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

function recordStat(id: string, latency: number, isUp: boolean, extraData?: any) {
  if (!state.stats[id]) state.stats[id] = [];
  state.stats[id].push({ time: new Date().toISOString(), latency, isUp, ...extraData });
  if (state.stats[id].length > MAX_HISTORY) {
    state.stats[id].shift();
  }
}

async function monitorHttp(target: any) {
  const start = Date.now();
  try {
    const options: any = { method: "GET" };
    if (target.source_ip) {
      options.localAddress = target.source_ip;
    }
    
    return new Promise((resolve) => {
      const isHttps = target.url.startsWith("https");
      const client = isHttps ? https : http;
      const req = client.request(target.url, options, (res) => {
        const latency = Date.now() - start;
        const isUp = res.statusCode ? res.statusCode >= 200 && res.statusCode < 400 : false;
        recordStat(target.id, latency, isUp);
        res.resume(); // consume data
        resolve(true);
      });
      req.on("error", (e) => {
        const latency = Date.now() - start;
        recordStat(target.id, latency, false);
        addLog(`HTTP Monitor [${target.id}] failed: ${e.message}`, "error");
        resolve(false);
      });
      req.end();
    });
  } catch (e: any) {
    recordStat(target.id, 0, false);
    addLog(`HTTP Monitor [${target.id}] failed: ${e.message}`, "error");
  }
}

async function monitorPing(target: any) {
  const cmd = ["ping", "-c", "1", "-W", "2"];
  if (target.source_ip) {
    cmd.push("-I", target.source_ip);
  }
  cmd.push(target.host);

  try {
    const { stdout, exitCode } = await runCommand(cmd);
    if (exitCode === 0) {
      // Parse linux ping output for time=XX ms
      const match = stdout.match(/time=([\d.]+)\s*ms/);
      const latency = match ? parseFloat(match[1]) : 0;
      recordStat(target.id, latency, true);
    } else {
      recordStat(target.id, 0, false);
      addLog(`Ping Monitor [${target.id}] host unreachable.`, "warn");
    }
  } catch (e: any) {
    recordStat(target.id, 0, false);
    addLog(`Ping Monitor [${target.id}] error: ${e.message}`, "error");
  }
}

async function monitorArp(target: any) {
  const cmd = ["arp-scan", "--localnet"];
  if (target.interface) {
    cmd.push("--interface", target.interface);
  }
  try {
    const { stdout, exitCode } = await runCommand(cmd);
    if (exitCode === 0) {
      // Simple parse of arp-scan
      const lines = stdout.split("\n").filter(l => l.includes(":") && l.split("\t").length >= 2);
      const devices = lines.map(l => {
        const parts = l.split("\t");
        return { ip: parts[0], mac: parts[1], vendor: parts[2] || "" };
      });
      recordStat(target.id, 0, true, { devices });
    } else {
      recordStat(target.id, 0, false, { devices: [] });
      addLog(`ARP Monitor [${target.id}] failed with exit code ${exitCode}.`, "warn");
    }
  } catch (e: any) {
    recordStat(target.id, 0, false, { devices: [] });
    addLog(`ARP Monitor [${target.id}] error: ${e.message}`, "error");
  }
}

async function pollingLoop() {
  if (!config.targets) return;
  for (const target of config.targets) {
    if (target.type === "http") {
      await monitorHttp(target);
    } else if (target.type === "ping") {
      await monitorPing(target);
    } else if (target.type === "arp") {
      await monitorArp(target);
    }
  }
  await saveState();
}

async function start() {
  await loadConfig();
  await loadState();

  const interval = config.polling?.interval || 5000;
  setInterval(pollingLoop, interval);

  serve({
    port: 3000,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/api/stats") {
        return new Response(JSON.stringify({ config, state }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      if (url.pathname === "/api/logs") {
        return new Response(JSON.stringify(state.logs), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Serve frontend static files
      const frontendDist = path.join(import.meta.dir, "frontend", "dist");
      let filePath = path.join(frontendDist, url.pathname);
      if (url.pathname === "/" || url.pathname === "") {
        filePath = path.join(frontendDist, "index.html");
      }
      
      const staticFile = file(filePath);
      if (await staticFile.exists()) {
        return new Response(staticFile);
      }
      
      // Fallback for SPA routing
      const indexFile = file(path.join(frontendDist, "index.html"));
      if (await indexFile.exists()) {
        return new Response(indexFile);
      }

      return new Response("Not found", { status: 404 });
    },
  });

  console.log(`Server running at http://localhost:3000`);
}

start();
