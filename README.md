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

### Prerequisites & Host Dependencies

To use all features of Hawk TUI, ensure the following tools are installed on your host system and available in your PATH:

### 1. Music Player
*   **mpv**: Required for background music playback.
    *   **Windows**: `choco install mpv`
    *   **macOS**: `brew install mpv`
    *   **Linux**: `sudo apt install mpv`

### 2. IT Tools (Traceroute, Ping, etc.)
*   **traceroute / tracert**: Usually pre-installed.
    *   **Linux**: `sudo apt install traceroute` (if missing)
*   **yt-dlp**: Required by mpv to stream YouTube audio.
    *   **All Platforms**: `pip install yt-dlp` or download from GitHub.

## Installation

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
