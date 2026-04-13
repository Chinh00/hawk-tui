import React, { useState } from 'react';
import { Box } from 'ink';
import { Sidebar } from './Sidebar.jsx';
import { MainView } from './MainView.jsx';
import { plugins } from '../plugins/index.js';

export const App: React.FC = () => {
  const [activeToolId, setActiveToolId] = useState<string | null>(plugins[0]?.id || null);

  const activeTool = plugins.find(p => p.id === activeToolId);

  const handleSelect = (item: { value: string }) => {
    setActiveToolId(item.value);
  };

  return (
    <Box padding={1} width="100%" height="100%">
      <Sidebar tools={plugins} onSelect={handleSelect} />
      <MainView activeTool={activeTool} />
    </Box>
  );
};
