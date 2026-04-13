import React from 'react';
import { Text, Box } from 'ink';
import { ToolPluginProps } from './types.js';
import os from 'os';

export const VersionInfo: React.FC<ToolPluginProps> = () => {
  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2} flexDirection="column">
        <Text bold color="yellow">🦅 HAWK TUI - System Control Center</Text>
        <Text color="gray">Version: <Text color="white" bold>1.0.0</Text></Text>
        <Text color="gray">License: <Text color="white">ISC</Text></Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold underline color="magenta">Build Information</Text>
        <Box flexDirection="row" marginTop={1}>
          <Box flexDirection="column" width={20}>
            <Text color="gray">Platform:</Text>
            <Text color="gray">Arch:</Text>
            <Text color="gray">Node Version:</Text>
            <Text color="gray">OS Release:</Text>
          </Box>
          <Box flexDirection="column">
            <Text color="white">{os.platform()}</Text>
            <Text color="white">{os.arch()}</Text>
            <Text color="white">{process.version}</Text>
            <Text color="white">{os.release()}</Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold underline color="green">Core Dependencies</Text>
        <Box flexDirection="row" flexWrap="wrap" marginTop={1}>
          <Box width="33%"><Text color="gray">React: <Text color="cyan">19.2.5</Text></Text></Box>
          <Box width="33%"><Text color="gray">Ink: <Text color="cyan">7.0.0</Text></Text></Box>
          <Box width="33%"><Text color="gray">TypeScript: <Text color="cyan">6.0.2</Text></Text></Box>
          <Box width="33%"><Text color="gray">Axios: <Text color="cyan">1.15.0</Text></Text></Box>
          <Box width="33%"><Text color="gray">SysInfo: <Text color="cyan">5.31.5</Text></Text></Box>
          <Box width="33%"><Text color="gray">TSX: <Text color="cyan">4.21.0</Text></Text></Box>
        </Box>
      </Box>

      <Box marginTop={2} borderStyle="single" borderColor="gray" paddingX={1}>
        <Text italic color="gray">
          "The eye of the hawk sees everything. Efficiency is not an option, it's a requirement."
        </Text>
      </Box>
      
      <Box marginTop={1} justifyContent="center">
        <Text dimColor color="gray">© 2026 Hawk TUI Team. All rights reserved.</Text>
      </Box>
    </Box>
  );
};
