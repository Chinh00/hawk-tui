import React, { useState, useEffect } from 'react';
import { Text, Box, Newline } from 'ink';
import TextInput from 'ink-text-input';
import si from 'systeminformation';

import { ToolPluginProps } from './types.js';

export const NetworkExplorer: React.FC<ToolPluginProps> = () => {
  const [query, setQuery] = useState('');
  const [connections, setConnections] = useState<si.Systeminformation.NetworkConnectionsData[]>([]);
  const [processMap, setProcessMap] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [connData, ps] = await Promise.all([
        si.networkConnections(),
        si.processes()
      ]);
      
      const pMap: Record<number, string> = {};
      ps.list.forEach(p => {
        pMap[p.pid] = p.name;
      });

      setProcessMap(pMap);
      setConnections(connData);
      setLoading(false);
    };

    fetchData();
    const timer = setInterval(fetchData, 1000); // Cập nhật mỗi 1s
    return () => clearInterval(timer);
  }, []);

  const getProcName = (c: si.Systeminformation.NetworkConnectionsData) => {
    return c.process || processMap[c.pid] || (c.pid ? `PID: ${c.pid}` : '-');
  };

  const filtered = connections.filter(c => {
    const local = `${c.localAddress || c.localaddress}:${c.localPort || c.localport}`;
    const remote = `${c.peerAddress || c.peeraddress}:${c.peerPort || c.peerport}`;
    const proc = getProcName(c);
    const searchStr = `${c.protocol} ${local} ${remote} ${c.state} ${proc}`.toLowerCase();
    return searchStr.includes(query.toLowerCase());
  });

  return (
    <Box flexDirection="column" flexGrow={1} padding={1} borderStyle="round" borderColor="magenta">
      <Box marginBottom={1}>
        <Text bold color="magenta">🌐 Network Connection Explorer</Text>
      </Box>

      {/* Search Box */}
      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginBottom={1}>
        <Text bold>Search: </Text>
        <TextInput value={query} onChange={setQuery} placeholder="Type port, IP, protocol or process..." />
      </Box>

      <Box flexDirection="row" borderStyle="single" borderColor="gray" paddingX={1}>
        <Box width={8}><Text bold>Proto</Text></Box>
        <Box width={25}><Text bold>Local Address</Text></Box>
        <Box width={25}><Text bold>Remote Address</Text></Box>
        <Box width={15}><Text bold>State</Text></Box>
        <Box flexGrow={1}><Text bold>Process</Text></Box>
      </Box>

      {loading ? (
        <Text color="yellow">  Scanning connections...</Text>
      ) : (
        <Box flexDirection="column">
          {filtered.slice(0, 20).map((c, i) => (
            <Box key={i} flexDirection="row" paddingX={1}>
              <Box width={8}>
                <Text color={c.protocol === 'tcp' ? 'cyan' : 'yellow'}>{c.protocol.toUpperCase()}</Text>
              </Box>
              <Box width={25}><Text wrap="truncate-end">{(c.localAddress || c.localaddress)}:{(c.localPort || c.localport)}</Text></Box>
              <Box width={25}><Text wrap="truncate-end" color="gray">{(c.peerAddress || c.peeraddress) || '*'}:{(c.peerPort || c.peerport) || '*'}</Text></Box>
              <Box width={15}>
                <Text color={c.state === 'ESTABLISHED' ? 'green' : 'gray'}>{c.state}</Text>
              </Box>
              <Box flexGrow={1}><Text color="blue" wrap="truncate-end">{getProcName(c)}</Text></Box>
            </Box>
          ))}
          
          {filtered.length > 20 && (
            <Text color="gray" italic>  ... and {filtered.length - 20} more results. Refine search to see more.</Text>
          )}
          
          {filtered.length === 0 && (
            <Text color="red" italic>  No connections matching "{query}"</Text>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="gray">Total: {connections.length} | Showing: {Math.min(filtered.length, 20)} | Refresh: 1s</Text>
      </Box>
    </Box>
  );
};
