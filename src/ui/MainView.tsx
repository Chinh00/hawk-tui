import React from 'react';
import { Box, Text } from 'ink';
import { ToolPlugin } from '../plugins/types.js';

interface MainViewProps {
  activeTool: ToolPlugin | undefined;
  activeSubMenuId?: string;
  isFocused?: boolean;
}

export const MainView: React.FC<MainViewProps> = ({ activeTool, activeSubMenuId, isFocused = false }) => {
  if (!activeTool) {
    return (
      <Box padding={2}>
        <Text italic color="gray">Select a tool from the sidebar to begin...</Text>
      </Box>
    );
  }

  const ToolComponent = activeTool.component;

  return (
    <Box 
      flexDirection="column" 
      paddingLeft={2} 
      flexGrow={1} 
      borderStyle="single" 
      borderColor={isFocused ? "white" : "gray"}
    >
      <Box marginBottom={1}>
        <Text bold color="blue">{activeTool.name}</Text>
        <Text color="gray"> - {activeTool.description}</Text>
      </Box>
      <ToolComponent activeSubMenuId={activeSubMenuId} isFocused={isFocused} />
    </Box>
  );
};
