# Hawk TUI Control Center

A powerful Terminal User Interface (TUI) Dashboard for real-time system and network monitoring, built with React and Ink.

## Features

- **System Overview:** Real-time CPU usage (with core-specific breakdown) and Memory monitoring.
- **Processes Monitor:** Searchable list of running processes with CPU, Memory, and Disk I/O stats.
- **Net Explorer:**
  - Track listening ports and active network connections.
  - Correlate network activity with specific process names and PIDs.
  - Searchable connection history.
- **Network Traffic:** Real-time throughput (Rx/Tx) monitoring for all active network interfaces.
- **Git Status:** Quick overview of the current repository status.

## Tech Stack

- **React** (via [Ink](https://github.com/vadimdemedes/ink))
- **TypeScript**
- **System Information** ([systeminformation](https://systeminformation.io/))

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## License

MIT
