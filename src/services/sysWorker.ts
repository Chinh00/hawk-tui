import { parentPort } from 'worker_threads';
import si from 'systeminformation';

const sendData = (data: any) => {
  if (parentPort) {
    parentPort.postMessage(data);
  } else if (process.send) {
    process.send(data);
  }
};

const fetchData = async () => {
  try {
    const [cpu, mem, netStats, netConn, ps, interfaces, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.networkStats(),
      si.networkConnections(),
      si.processes(),
      si.networkInterfaces(),
      si.osInfo()
    ]);

    // Detect WSL
    let isWsl = false;
    let wslVersion: number | undefined = undefined;
    const kernel = osInfo.kernel.toLowerCase();
    if (kernel.includes('microsoft')) {
      isWsl = true;
      wslVersion = kernel.includes('wsl2') ? 2 : 1;
    }

    sendData({
      cpu,
      mem,
      netStats,
      netConn,
      interfaces: interfaces.filter(i => i.ip4 || i.ip6),
      processes: ps.list,
      osInfo,
      wslInfo: { isWsl, version: wslVersion },
      time: new Date().toLocaleTimeString()
    });
  } catch (err) {
    sendData({ error: (err as Error).message });
  }
};

// Polling
fetchData();
setInterval(fetchData, 1000);
