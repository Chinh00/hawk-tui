import React, { useState, useEffect } from 'react';
import { Box, useInput, useApp, Text } from 'ink';
import { Sidebar } from './Sidebar.jsx';
import { SubSidebar } from './SubSidebar.jsx';
import { MainView } from './MainView.jsx';
import { Help } from './Help.jsx';
import { plugins } from '../plugins/index.js';

type Pane = 'SIDEBAR' | 'SUB_SIDEBAR' | 'CONTENT';

export const App: React.FC = () => {
  const { exit } = useApp();
  const [activeToolId, setActiveToolId] = useState<string | null>(plugins[0]?.id || null);
  const [activeSubMenuId, setActiveSubMenuId] = useState<string | undefined>(undefined);
  const [activePane, setActivePane] = useState<Pane>('SIDEBAR');
  const [showHelp, setShowHelp] = useState(false);

  const activeTool = plugins.find(p => p.id === activeToolId);

  useEffect(() => {
    if (activeTool && activeTool.subMenus && activeTool.subMenus.length > 0) {
      setActiveSubMenuId(activeTool.subMenus[0].id);
    } else {
      setActiveSubMenuId(undefined);
    }
    setActivePane('SIDEBAR');
  }, [activeToolId]);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (input === 'h') {
      setShowHelp(!showHelp);
      return;
    }

    if (showHelp) {
      if (key.escape) setShowHelp(false);
      return;
    }

    if (key.tab) {
      if (activePane === 'SIDEBAR') {
        if (activeTool?.subMenus) setActivePane('SUB_SIDEBAR');
        else setActivePane('CONTENT');
      } else if (activePane === 'SUB_SIDEBAR') {
        setActivePane('CONTENT');
      } else {
        setActivePane('SIDEBAR');
      }
    }
    
    if (key.rightArrow) {
      if (activePane === 'SIDEBAR' && activeTool?.subMenus) setActivePane('SUB_SIDEBAR');
      else if (activePane === 'SUB_SIDEBAR') setActivePane('CONTENT');
    }

    if (key.leftArrow) {
      if (activePane === 'CONTENT' && activeTool?.subMenus) setActivePane('SUB_SIDEBAR');
      else if (activePane === 'CONTENT' || activePane === 'SUB_SIDEBAR') setActivePane('SIDEBAR');
    }
  });

  const handleSelectTool = (item: { value: string }) => {
    setActiveToolId(item.value);
  };

  const handleSelectSubMenu = (item: { value: string }) => {
    setActiveSubMenuId(item.value);
  };

  return (
    <Box padding={1} width="100%" height="100%" flexDirection="column">
      <Box flexGrow={1}>
        <Sidebar 
          tools={plugins} 
          onSelect={handleSelectTool} 
          isFocused={!showHelp && activePane === 'SIDEBAR'} 
        />
        {activeTool?.subMenus && (
          <SubSidebar 
            subMenus={activeTool.subMenus} 
            onSelect={handleSelectSubMenu} 
            isFocused={!showHelp && activePane === 'SUB_SIDEBAR'}
          />
        )}
        <MainView 
          activeTool={activeTool} 
          activeSubMenuId={activeSubMenuId} 
          isFocused={!showHelp && activePane === 'CONTENT'}
        />
      </Box>

      {showHelp && (
        <Box 
          position="absolute" 
          width="100%" 
          height="100%" 
          alignItems="center" 
          justifyContent="center"
        >
          <Help />
        </Box>
      )}

      {/* Footer / Status Bar */}
      <Box borderStyle="classic" borderColor="gray" paddingX={1} marginTop={1} justifyContent="space-between">
        <Text color="gray">Focused: <Text color="cyan">{activePane}</Text></Text>
        <Box>
          <Text color="gray"> h: help | q: quit </Text>
        </Box>
      </Box>
    </Box>
  );
};
