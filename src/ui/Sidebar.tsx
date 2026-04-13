import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { ToolPlugin } from '../plugins/types.js';

interface SidebarProps {
  tools: ToolPlugin[];
  onSelect: (item: { value: string }) => void;
  isFocused?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ tools, onSelect, isFocused = true }) => {
  const items = tools.map(tool => ({
    label: tool.name,
    value: tool.id
  }));

  return (
    <Box 
      flexDirection="column" 
      paddingRight={2} 
      borderStyle="single" 
      borderColor={isFocused ? "yellow" : "gray"}
      width={25}
    >
      <Text bold color="yellow">🦅 HAWK</Text>
      <Box height={1} />
      <SelectInput items={items} onSelect={onSelect} isFocused={isFocused} />
    </Box>
  );
};
