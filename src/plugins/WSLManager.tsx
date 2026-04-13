import React, { useState, useEffect } from 'react';
import { Text, Box, useInput } from 'ink';
import { ToolPluginProps } from './types.js';
import { exec } from 'child_process';
import os from 'os';

interface WslDistro {
  name: string;
  status: string;
  version: string;
  isDefault: boolean;
}

export const WSLManager: React.FC<ToolPluginProps> = ({ isFocused }) => {
  const [distros, setDistros] = useState<WslDistro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const isWin = os.platform() === 'win32';

  const fetchDistros = () => {
    if (!isWin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    // wsl -l -v output is often UTF-16LE, we clean up null bytes and weird whitespace
    exec('wsl -l -v', (err, stdout) => {
      if (err) {
        setError('WSL not found or not responding. Ensure WSL is installed.');
        setLoading(false);
        return;
      }

      // Clean up the output string from potential null bytes or BOM
      const cleanStdout = stdout.replace(/\0/g, '').trim();
      const lines = cleanStdout.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (lines.length <= 1) {
        setDistros([]);
        setLoading(false);
        return;
      }

      // Parse output (skipping header)
      const parsed: WslDistro[] = lines.slice(1).map(line => {
        const isDefault = line.startsWith('*');
        const content = line.replace('*', '').trim();
        const parts = content.split(/\s+/);
        
        return {
          name: parts[0] || 'Unknown',
          status: parts[1] || 'Stopped',
          version: parts[2] || '?',
          isDefault
        };
      }).filter(d => d.name !== 'Unknown');

      setDistros(parsed);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchDistros();
    const timer = setInterval(fetchDistros, 5000);
    return () => clearInterval(timer);
  }, []);

  const runCommand = (cmd: string, successMsg: string) => {
    setMessage(`Running: ${cmd}...`);
    exec(cmd, (err) => {
      if (err) setMessage(`Error: ${err.message}`);
      else {
        setMessage(`✅ ${successMsg}`);
        fetchDistros();
      }
      setTimeout(() => setMessage(null), 3000);
    });
  };

  useInput((input, key) => {
    if (!isFocused || loading || !isWin) return;

    if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
    if (key.downArrow) setSelectedIndex(Math.min(distros.length - 1, selectedIndex + 1));
    
    if (distros.length > 0) {
      const selected = distros[selectedIndex];
      if (input === 't') runCommand(`wsl --terminate ${selected.name}`, `Terminated ${selected.name}`);
      if (input === 's') runCommand(`wsl --shutdown`, `WSL fully shut down`);
      if (input === 'd') runCommand(`wsl --set-default ${selected.name}`, `Set ${selected.name} as default`);
    }
    
    if (input === 'r') fetchDistros();
  });

  if (!isWin) {
    return (
      <Box padding={1} flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
        <Text color="red" bold>🚫 WSL Manager is only available on Windows</Text>
        <Text color="gray">Detected platform: {os.platform()}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Text bold color="yellow">🐳 WSL Instance Manager</Text>
        <Text color="gray">r: Refresh | s: Shutdown All</Text>
      </Box>

      {error ? (
        <Box marginTop={1}><Text color="red">{error}</Text></Box>
      ) : loading && distros.length === 0 ? (
        <Box marginTop={1}><Text color="cyan">Loading WSL instances...</Text></Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          <Box flexDirection="row" borderBottomStyle="single" borderColor="gray" marginBottom={1}>
            <Box width={5}><Text bold>DEF</Text></Box>
            <Box width={25}><Text bold>NAME</Text></Box>
            <Box width={15}><Text bold>STATUS</Text></Box>
            <Box width={10}><Text bold>VERSION</Text></Box>
          </Box>

          {distros.map((d, i) => (
            <Box key={`wsl-${d.name || i}`}>
              <Text color={i === selectedIndex ? "cyan" : "white"}>
                {i === selectedIndex ? "> " : "  "}
              </Text>
              <Box width={5}><Text color="yellow">{d.isDefault ? " * " : "   "}</Text></Box>
              <Box width={25}><Text color={d.status === 'Running' ? "green" : "white"}>{d.name}</Text></Box>
              <Box width={15}><Text color={d.status === 'Running' ? "green" : "gray"}>{d.status}</Text></Box>
              <Box width={10}><Text>{d.version}</Text></Box>
            </Box>
          ))}

          <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={1} flexDirection="column">
            <Text bold color="magenta">Controls for [{distros[selectedIndex]?.name}]:</Text>
            <Text> t: Terminate (Stop) | d: Set as Default</Text>
            {message && <Text color="cyan" bold marginTop={1}>{message}</Text>}
          </Box>
        </Box>
      )}
    </Box>
  );
};
