import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { ToolPlugin } from '../plugins/types.js';

interface SidebarProps {
  tools: ToolPlugin[];
  onSelect: (item: { value: string }) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ tools, onSelect }) => {
  const items = tools.map(tool => ({
    label: tool.name,
    value: tool.id
  }));

  return (
    <Box flexDirection="column" paddingRight={2} borderStyle="single" borderColor="gray">
      <Text bold color="yellow">🦅 HAWK</Text>
      <Box height={1} />
      <SelectInput items={items} onSelect={onSelect} />
    </Box>
  );
};
