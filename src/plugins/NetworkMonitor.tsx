import React, { useState, useEffect } from 'react';
import { Text, Box, Newline } from 'ink';
import si from 'systeminformation';

import { ToolPluginProps } from './types.js';

export const NetworkMonitor: React.FC<ToolPluginProps> = () => {
  const [stats, setStats] = useState<si.Systeminformation.NetworkStatsData[]>([]);
  const [connections, setConnections] = useState<si.Systeminformation.NetworkConnectionsData[]>([]);
  const [time, setTime] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const [s, c] = await Promise.all([
        si.networkStats(),
        si.networkConnections()
      ]);
      
      setStats(s);
      // Chỉ lấy top 10 kết nối đang hoạt động để tránh tràn màn hình
      setConnections(c.slice(0, 15));
      setTime(new Date().toLocaleTimeString());
    };

    fetchData();
    const timer = setInterval(fetchData, 2000); // Cập nhật mạng mỗi 2s để cân bằng hiệu năng
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
      <Box justifyContent="space-between">
        <Text color="blue" bold>Network Monitor</Text>
        <Text color="gray"> Last Update: {time}</Text>
      </Box>
      <Newline />

      <Text bold underline>Interface Throughput:</Text>
      {stats.map((iface, i) => (
        <Box key={i} flexDirection="column" marginLeft={2}>
          {iface.operstate === 'up' && (
            <Text>
              {iface.iface}: 
              <Text color="green"> ↓ {(iface.rx_sec / 1024).toFixed(1)} KB/s</Text> | 
              <Text color="yellow"> ↑ {(iface.tx_sec / 1024).toFixed(1)} KB/s</Text>
            </Text>
          )}
        </Box>
      ))}

      <Newline />
      <Text bold underline>Active Connections (Top 15):</Text>
      <Box flexDirection="row" marginLeft={2}>
        <Box width={10}><Text bold>Proto</Text></Box>
        <Box width={25}><Text bold>Local Address</Text></Box>
        <Box width={25}><Text bold>Remote Address</Text></Box>
        <Box><Text bold>State</Text></Box>
      </Box>
      
      {connections.map((conn, i) => (
        <Box key={i} flexDirection="row" marginLeft={2}>
          <Box width={10}>
            <Text color={conn.protocol === 'tcp' ? 'cyan' : 'yellow'}>
              {conn.protocol.toUpperCase()}
            </Text>
          </Box>
          <Box width={25}><Text wrap="truncate-end">{(conn.localAddress || conn.localaddress)}:{(conn.localPort || conn.localport)}</Text></Box>
          <Box width={25}><Text wrap="truncate-end">{(conn.peerAddress || conn.peeraddress) || '*'}:{(conn.peerPort || conn.peerport) || '*'}</Text></Box>
          <Box><Text color={conn.state === 'ESTABLISHED' ? 'green' : 'gray'}>{conn.state}</Text></Box>
        </Box>
      ))}
      
      {connections.length === 0 && <Text italic color="gray">  No active connections found...</Text>}
    </Box>
  );
};
