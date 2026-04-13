import React, { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { ToolPluginProps } from './types.js';
import { spawn } from 'child_process';
import os from 'os';

interface SubTool {
  id: string;
  name: string;
  category: 'Network' | 'Security' | 'Utils';
  labels: string[];
  description: string;
}

const TOOLS: SubTool[] = [
  {
    id: 'traceroute',
    name: 'Traceroute',
    category: 'Network',
    labels: ['diagnostic', 'network'],
    description: 'Track the path of packets across IP network'
  },
  {
    id: 'ping',
    name: 'Ping',
    category: 'Network',
    labels: ['diagnostic', 'latency'],
    description: 'Test connectivity to a host'
  },
  {
    id: 'nslookup',
    name: 'DNS Lookup',
    category: 'Network',
    labels: ['diagnostic', 'dns'],
    description: 'Query DNS name servers'
  }
];

export const ITTools: React.FC<ToolPluginProps> = ({ activeSubMenuId, isFocused, onInputFocus }) => {
  const [search, setSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  
  // Sub-tool states (Traceroute)
  const [target, setTarget] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string[]>([]);
  const [isInputtingTarget, setIsInputtingTarget] = useState(false);

  const filteredTools = TOOLS.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                         t.labels.some(l => l.includes(search.toLowerCase()));
    const matchesCategory = activeSubMenuId === 'all' || 
                           (activeSubMenuId === 'network' && t.category === 'Network') ||
                           (activeSubMenuId === 'utils' && t.category === 'Utils');
    return matchesSearch && matchesCategory;
  });

  const runTraceroute = () => {
    if (!target.trim()) return;
    setIsRunning(true);
    setIsInputtingTarget(false);
    onInputFocus?.(false);
    setOutput([`Traceroute to ${target}...`]);

    const isWin = os.platform() === 'win32';
    const cmd = isWin ? 'tracert' : 'traceroute';
    const proc = spawn(cmd, [target]);

    proc.stdout.on('data', (data) => {
      setOutput(prev => [...prev.slice(-15), data.toString().trim()]);
    });

    proc.stderr.on('data', (data) => {
      setOutput(prev => [...prev, `Error: ${data.toString()}`]);
    });

    proc.on('close', (code) => {
      setIsRunning(false);
      setOutput(prev => [...prev, `--- Finished with code ${code} ---`]);
    });
  };

  useInput((input, key) => {
    if (!isFocused || isRunning) return;

    if (isInputtingTarget) {
      if (key.escape) { setIsInputtingTarget(false); onInputFocus?.(false); }
      return;
    }

    if (isSearching) {
      if (key.escape) { setIsSearching(false); onInputFocus?.(false); }
      return;
    }

    if (activeToolId) {
      if (key.escape || input === 'b') { setActiveToolId(null); setOutput([]); }
      if (activeToolId === 'traceroute' && input === 'r') { setIsInputtingTarget(true); onInputFocus?.(true); }
      return;
    }

    if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
    if (key.downArrow) setSelectedIndex(Math.min(filteredTools.length - 1, selectedIndex + 1));
    if (key.return && filteredTools[selectedIndex]) {
      setActiveToolId(filteredTools[selectedIndex].id);
    }
    if (input === '/') { setIsSearching(true); onInputFocus?.(true); }
  });

  const selectedTool = filteredTools[selectedIndex];

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="cyan">🛠️ IT Tools Explorer</Text>
        <Text color="gray">/: Search | Enter: Select | b: Back</Text>
      </Box>

      {!activeToolId ? (
        <Box flexDirection="column">
          {/* Search Bar */}
          <Box borderStyle="round" borderColor={isSearching ? "cyan" : "gray"} paddingX={1} marginBottom={1}>
            <Text bold color={isSearching ? "cyan" : "white"}>🔍 Search: </Text>
            {isSearching ? <TextInput value={search} onChange={setSearch} /> : <Text color="gray">{search || "Search tools or labels..."}</Text>}
          </Box>

          <Box flexDirection="row">
            {/* Tools List */}
            <Box flexDirection="column" width={40} borderRightStyle="single" borderColor="gray" paddingRight={1}>
              {filteredTools.map((t, i) => (
                <Box key={t.id} flexDirection="column" marginBottom={1}>
                  <Text color={i === selectedIndex ? "cyan" : "white"}>
                    {i === selectedIndex ? "> " : "  "}{t.name}
                  </Text>
                  <Box marginLeft={4} flexDirection="row">
                    {t.labels.map(l => (
                      <Text key={l} color="magenta" dimColor fontSize="small"> #{l}</Text>
                    ))}
                  </Box>
                </Box>
              ))}
            </Box>

            {/* Details */}
            <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
              {selectedTool && (
                <>
                  <Text bold underline color="yellow">{selectedTool.name}</Text>
                  <Text italic color="gray" marginBottom={1}>{selectedTool.description}</Text>
                  <Text>Category: <Text color="green">{selectedTool.category}</Text></Text>
                  <Box marginTop={1}>
                    <Text color="gray">Labels: </Text>
                    {selectedTool.labels.map(l => <Text key={l} color="magenta"> [{l}] </Text>)}
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column" flexGrow={1}>
          <Box borderBottomStyle="single" borderColor="cyan" marginBottom={1} justifyContent="space-between">
            <Text bold color="yellow">Running: {activeToolId.toUpperCase()}</Text>
            <Text color="gray">Press 'b' to go back</Text>
          </Box>

          {activeToolId === 'traceroute' && (
            <Box flexDirection="column">
              <Box marginBottom={1}>
                <Text bold>Target Host: </Text>
                {isInputtingTarget ? (
                  <TextInput value={target} onChange={setTarget} onSubmit={runTraceroute} />
                ) : (
                  <Text color="cyan">{target || "None (Press 'r' to set target)"}</Text>
                )}
              </Box>

              <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} minHeight={10}>
                {output.length > 0 ? output.map((line, i) => (
                  <Text key={i} color="white">{line}</Text>
                )) : (
                  <Text italic color="gray">Output will appear here...</Text>
                )}
              </Box>
              <Text color="gray" marginTop={1}>r: Set Target & Run | b: Back</Text>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
