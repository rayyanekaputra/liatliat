# network dashboard

a lightweight network monitoring dashboard. no database required. runs on bun, vite, react, and tailwind.

## features
- memory-backed data store with json persistence.
- monitors endpoints via http get, icmp ping, and arp scans.
- supports source ip binding for multiple network interfaces.
- configurable entirely via a `.toml` file.

## setup

### requirements
- bun
- `ping` and `arp-scan` installed on host system
- linux/unix environment

### build instructions

clone the repository, then build the frontend:

```bash
cd frontend
bun install
bun run build
cd ..
```

run the backend server (root required for icmp and raw sockets):

```bash
sudo bun run server.ts
```

access the interface at `http://localhost:3000`.

---

## configuration

all settings are defined in `config.toml` at the project root. no code modification is necessary to add targets.

### global config

```toml
# prepends sudo to commands if set to true.
# requires nopasswd in sudoers if not running the server as root.
use_sudo = false

[polling]
# interval for checking all targets in milliseconds.
interval = 5000
```

### targets

append as many `[[targets]]` blocks as needed.

#### http monitor
checks url availability and latency.

```toml
[[targets]]
id = "google_http"
group = "external services"
type = "http"
name = "google frontend"
url = "https://www.google.com"
source_ip = "192.168.1.10" # optional: binds to local ip
```

#### ping monitor
executes an icmp echo request.

```toml
[[targets]]
id = "cloudflare_ping"
group = "external services"
type = "ping"
name = "cloudflare dns"
host = "1.1.1.1"
source_ip = "192.168.1.10" # optional: binds to local ip
```

#### arp scan
scans the local subnet for active devices.

```toml
[[targets]]
id = "local_arp"
group = "internal network"
type = "arp"
name = "office devices"
interface = "eth0" # required: network interface to scan
```

## architecture details
- **backend**: bun parses the toml file, loops through targets, wraps native system commands, and serves static files.
- **persistence**: state is written to `data.json` periodically to preserve history between restarts.
- **frontend**: react application fetching from local api routes.

## license
mit
