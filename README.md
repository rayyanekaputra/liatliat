# 🌐 Minimalist Network Dashboard

A high-performance, ultra-lightweight network monitoring dashboard inspired by Grafana and Vercel's design system. Built with **Bun**, **Vite**, **React**, and **Tailwind CSS**.

![Dashboard Screenshot](https://via.placeholder.com/1200x600.png?text=Network+Monitoring+Dashboard)

## ✨ Features
- **Zero Database Required**: Purely memory-backed with periodic JSON persistence.
- **Protocol Support**: Monitor endpoints via HTTP GET, ICMP Ping, and ARP Scans.
- **Source IP Binding**: Seamlessly monitor through different server NICs/IPs.
- **Hot Configurable**: Powered entirely by a single `.toml` file.
- **Sleek UI**: Dark mode out of the box, powered by Tailwind and Recharts.

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) (v1.0+)
- `ping` and `arp-scan` available on your host OS (`sudo apt install arp-scan`)
- Linux/Unix host environment

### Installation

1. Clone the repository and navigate to the directory:
   ```bash
   git clone <your-repo-url>
   cd <your-repo>
   ```

2. Build the frontend (if you are running from source):
   ```bash
   cd frontend
   bun install
   bun run build
   cd ..
   ```

3. Run the server (Root is required for `ping` and `arp-scan`):
   ```bash
   sudo bun run server.ts
   ```

4. Visit `http://localhost:3000` in your browser!

---

## ⚙️ Configuration (`config.toml`)

The entire dashboard is configured through `config.toml` in the root directory. You do not need to touch any code to add new monitoring targets.

### Global Settings

```toml
# If true, prepends 'sudo' to ping and arp-scan. 
# Only use this if you run the server without sudo and have NOPASSWD configured in /etc/sudoers.
use_sudo = false

[polling]
# How often to check all targets (in milliseconds)
interval = 5000
```

### Targets

You can add as many `[[targets]]` blocks as you want. Each block represents a card on your dashboard.

#### 1. HTTP Monitor
Polls a specific URL and records the latency and response code.

```toml
[[targets]]
id = "google_main"               # Unique identifier (no spaces)
type = "http"                    # Must be "http"
name = "Google Frontend"         # Display name on the dashboard
url = "https://www.google.com"   # Target URL
source_ip = "192.168.1.10"       # (Optional) Bind request to a specific local IP/NIC
```

#### 2. Ping Monitor
Executes a system ping (ICMP) to measure exact network latency.

```toml
[[targets]]
id = "cloudflare_dns"            # Unique identifier
type = "ping"                    # Must be "ping"
name = "Cloudflare DNS"          # Display name on the dashboard
host = "1.1.1.1"                 # Target IP or hostname
source_ip = "192.168.1.10"       # (Optional) Bind ping to a specific local IP (-I flag)
```

#### 3. ARP Scan
Discovers devices locally connected to a specific subnet.

```toml
[[targets]]
id = "local_network"             # Unique identifier
type = "arp"                     # Must be "arp"
name = "Office Devices"          # Display name on the dashboard
interface = "eth0"               # Network interface to run the ARP scan on
```

## 🛠️ Architecture
- **Bun Backend (`server.ts`)**: Loads the TOML config, runs `setInterval` polling loops wrapping native system commands (`Bun.spawn`), and serves the Vite static files + APIs.
- **Persistence (`data.json`)**: To prevent data loss upon restarts, the backend periodically dumps the last 200 data points of each target to `data.json`.
- **React Frontend (`frontend/`)**: Periodically fetches `/api/stats` and renders Recharts.

## 📄 License
MIT License
