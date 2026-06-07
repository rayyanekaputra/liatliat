# Network Monitoring Dashboard Implementation Plan

## Overview
A high-performance, lightweight network monitoring dashboard. The system is designed for maximum simplicity—no database is required. It reads user configurations via a **TOML file** and prevents data loss by periodically saving its state to a **JSON file**. **No Next.js is used.**

## Technology Stack
- **Server / Backend:** **Bun** (using the built-in `Bun.serve()`). 
- **Configuration:** TOML (parsed natively by Bun) for managing all settings without modifying code.
- **Frontend Framework:** Vite + React (React is required to use the Shadcn UI design system). 
- **Styling:** Tailwind CSS + Shadcn UI (Dark mode, flat colors, no gradients, Vercel design style).
- **Charts:** Recharts for rendering Grafana-like line and area charts.
- **Network Tools:**
  - Native system commands via `Bun.spawn` wrapping `ping` and `arp-scan` utilities.
  - Native Node `http/https` layer for GET monitoring (allows binding to specific source IPs).

## Architecture
The application is decoupled into a backend runner/server and a static frontend.

### 1. Configuration & Persistence
- **`config.toml`**: The sole source of truth. Users define targets, target types (HTTP, Ping, ARP), polling intervals, and source IPs.
- **`data.json`**: Instead of purely relying on RAM, the Bun server periodically dumps its in-memory metrics to this file. Upon starting, the server loads this file to restore historical graph data.

### 2. Data Collection Engine (Bun Server)
An internal polling mechanism runs asynchronously:
- **HTTP GET Monitor:** Periodically fetches target URLs using `node:http/https` to bind `localAddress` when a source IP is specified. 
- **Ping Monitor:** Executes `ping` commands using `Bun.spawn`. Supports source IP binding (`-I <source_ip>`).
- **ARP Monitor:** Executes `arp-scan` to discover active network devices.
- **Privilege Management:** `ping` and `arp-scan` require elevated privileges. Rather than handling `sudo` within child processes (which causes TTY blocking), the **entire Bun server should be run as root** (e.g., `sudo bun run server.ts`). 
- **API Endpoints:** `Bun.serve` exposes `/api/stats` and `/api/logs` to the frontend.

### 3. Dashboard Interface (React Frontend)
A sleek, dark-mode Vercel/Shadcn-styled UI.
- **Layout:** Grid-based dashboard.
- **Components:**
  - **Stat Cards:** Uptime percentage, current latency, and active hosts.
  - **Latency Graphs:** Recharts Area/Line charts showing latency over time.
  - **Host Grid:** A dynamic list of devices discovered via ARP.
  - **Live Log Viewer:** A terminal window component displaying a real-time event log.

## Step-by-Step Implementation

### Phase 1: Foundation
1. Initialize a new Vite React application for the frontend.
2. Configure `vite.config.ts` to proxy `/api` requests to the Bun backend (port 3000) to bypass CORS issues during development.
3. Initialize a basic Bun server for the backend.
4. Install Tailwind CSS, Recharts, and Shadcn UI on the frontend. Apply a strict dark mode theme.

### Phase 2: Core Configuration & Persistence (Bun Server)
1. **Config Loader:** Implement a function to read and parse `config.toml`.
2. **State Manager:** Implement the logic to load `data.json` on startup and save the in-memory data to `data.json` periodically (e.g., every 10 seconds).

### Phase 3: Core Network Services (Bun Server)
1. **Execution wrappers:** Build helper functions using `Bun.spawn` for Linux `ping` and `arp-scan`. 
2. **State Loop:** Setup polling loops that trigger the network services and update the memory store based on the TOML targets.

### Phase 4: API Setup & Frontend Data
1. Implement `Bun.serve` to route requests:
   - `/api/stats` -> Returns the current charts data.
   - `/api/logs` -> Returns recent system events.
   - `/*` -> Serves the static Vite frontend files for production.
2. Build the Recharts and Shadcn frontend to consume these endpoints.

### Phase 5: Deployment & Polish
1. Build the Vite app using `bun run build`.
2. Document clearly that the user must run `sudo bun run server.ts` to grant network capabilities.
3. Test with multiple IPs.
