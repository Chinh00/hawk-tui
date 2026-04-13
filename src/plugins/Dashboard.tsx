import React, { useState, useEffect, useRef } from 'react';
import { Text, Box } from 'ink';
import TextInput from 'ink-text-input';
import si from 'systeminformation';
import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import { ToolPluginProps } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const Dashboard: React.FC<ToolPluginProps> = () => {
  const [data, setData] = useState<{
    cpu: si.Systeminformation.CurrentLoadData;
    mem: si.Systeminformation.MemData;
    netStats: si.Systeminformation.NetworkStatsData[];
    netConn: si.Systeminformation.NetworkConnectionsData[];
    interfaces: si.Systeminformation.NetworkInterfacesData[];
    processes: si.Systeminformation.ProcessData[];
    osInfo: si.Systeminformation.OsData;
    wslInfo: { isWsl: boolean; version?: number };
    time: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [procQuery, setProcQuery] = useState('');
  const workerRef = useRef<ChildProcess | null>(null);

  useEffect(() => {
    const workerPath = path.resolve(__dirname, '../services/sysWorker.ts');
    
    try {
      // Dùng fork để chạy file .ts với tsx loader
      const child = fork(workerPath, [], {
        execArgv: process.execArgv,
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      });

      child.on('error', (err) => {
        setError(`Process error: ${err.message}`);
      });

      child.on('exit', (code) => {
        if (code !== 0 && code !== null) setError(`Process exited with code ${code}`);
      });

      child.on('message', (msg: any) => {
        if (msg.error) {
          setError(`System error: ${msg.error}`);
          return;
        }
        setError(null);
        setData(msg);
      });

      workerRef.current = child;
    } catch (e) {
      setError(`Failed to fork process: ${(e as Error).message}`);
    }

    return () => {
      workerRef.current?.kill();
    };
  }, []);

  if (error) return (
    <Box padding={1} flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} borderStyle="double" borderColor="red">
      <Text color="red" bold>❌ Dashboard Worker Error</Text>
      <Box marginTop={1}>
        <Text color="white">{error}</Text>
      </Box>
      <Text color="gray" marginTop={1}>Check if tsx is correctly resolving paths</Text>
    </Box>
  );

  if (!data) return (
    <Box padding={1} flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Text color="yellow">📡 Connecting to System Worker Thread...</Text>
      <Text color="gray" dimColor>Offloading I/O intensive tasks to keep UI responsive</Text>
    </Box>
  );

  const filteredProcesses = data.processes
    .filter(p => p.name.toLowerCase().includes(procQuery.toLowerCase()) || p.pid.toString().includes(procQuery))
    .sort((a, b) => b.cpu - a.cpu)
    .slice(0, 8);

  const memUsedGB = data.mem.used / 1024 / 1024 / 1024;
  const memTotalGB = data.mem.total / 1024 / 1024 / 1024;
  const memPercent = (data.mem.used / data.mem.total) * 100;

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header Row */}
      <Box justifyContent="space-between" borderStyle="single" borderColor="gray" paddingX={1}>
        <Box flexDirection="column">
          <Text color="green" bold>鷹 HAWK CONTROL CENTER [MULTI-THREADED]</Text>
          <Box>
            <Text color="gray">OS: </Text>
            <Text color="white">{data.osInfo.distro} {data.osInfo.release} ({data.osInfo.arch})</Text>
            {data.wslInfo.isWsl && (
              <Text color="cyan"> [WSL v{data.wslInfo.version}]</Text>
            )}
          </Box>
        </Box>
        <Box flexDirection="column" alignItems="flex-end">
          <Box>
            <Text color="gray">IPs: </Text>
            {data.interfaces.map((itf, idx) => (
              <Text key={`ip-${itf.iface || idx}`} color="cyan">
                {itf.ip4}{idx < data.interfaces.length - 1 ? ', ' : ''}
              </Text>
            ))}
          </Box>
          <Text color="gray">{data.time}</Text>
        </Box>
      </Box>

      {/* Main Stats Row (CPU & Memory) */}
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width="50%">
          <Text bold color="cyan">CPU Usage</Text>
          <Text>Overall: <Text color={data.cpu.currentLoad > 80 ? 'red' : 'green'}>{data.cpu.currentLoad.toFixed(1)}%</Text></Text>
          <Box marginTop={1}>
            <Text color="gray">Cores: </Text>
            {data.cpu.cpus.map((c, i) => (
              <Text key={`core-${i}`} color={c.load > 80 ? 'red' : 'gray'}>█</Text>
            ))}
          </Box>
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1} width="50%" marginLeft={1}>
          <Text bold color="blue">Memory</Text>
          <Text>{memUsedGB.toFixed(2)} / {memTotalGB.toFixed(2)} GB</Text>
          <Box marginTop={1}>
            <Text color="blue">{'█'.repeat(Math.round(memPercent / 5))}</Text>
            <Text color="gray">{'░'.repeat(20 - Math.round(memPercent / 5))}</Text>
            <Text> {memPercent.toFixed(1)}%</Text>
          </Box>
        </Box>
      </Box>

      {/* Process Monitor Section */}
      <Box flexDirection="column" borderStyle="round" borderColor="white" paddingX={1} marginTop={1}>
        <Box justifyContent="space-between" marginBottom={1}>
          <Text bold color="white">Processes Monitor (Top CPU)</Text>
          <Box>
            <Text bold color="gray">Search: </Text>
            <TextInput value={procQuery} onChange={setProcQuery} placeholder="Filter processes..." />
          </Box>
        </Box>
        
        <Box flexDirection="row" borderBottomStyle="single" borderColor="gray">
          <Box width={10}><Text bold color="gray">PID</Text></Box>
          <Box width={20}><Text bold color="gray">Name</Text></Box>
          <Box width={10}><Text bold color="gray">CPU %</Text></Box>
          <Box width={15}><Text bold color="gray">MEM (MB)</Text></Box>
          <Box flexGrow={1}><Text bold color="gray">Disk R/W</Text></Box>
        </Box>

        {filteredProcesses.map((p) => (
          <Box key={`proc-${p.pid}`} flexDirection="row">
            <Box width={10}><Text color="gray">{p.pid}</Text></Box>
            <Box width={20}><Text wrap="truncate-end" color="white">{p.name}</Text></Box>
            <Box width={10}>
              <Text color={p.cpu > 10 ? 'red' : 'green'}>{p.cpu.toFixed(1)}</Text>
            </Box>
            <Box width={15}><Text color="blue">{(p.memRss / 1024).toFixed(0)} MB</Text></Box>
            <Box flexGrow={1}>
              <Text color="yellow">R:{(p.read_bytes / 1024).toFixed(0)}K W:{(p.write_bytes / 1024).toFixed(0)}K</Text>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Network Traffic Overview */}
      <Box flexDirection="row" marginTop={1}>
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1} width="100%">
          <Text bold color="magenta">Network Traffic Overview</Text>
          <Box flexDirection="row">
            {data.netStats.filter(n => n.operstate === 'up').map((n, i) => (
              <Box key={`net-${n.iface || i}`} marginRight={4}>
                <Text color="gray">{n.iface}: </Text>
                <Text color="green">↓{(n.rx_sec/1024).toFixed(0)}KB/s</Text>
                <Text color="yellow"> ↑{(n.tx_sec/1024).toFixed(0)}KB/s</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
