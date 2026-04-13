import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { SubMenu } from '../plugins/types.js';

interface SubSidebarProps {
  subMenus: SubMenu[];
  onSelect: (item: { value: string }) => void;
  isFocused?: boolean;
}

export const SubSidebar: React.FC<SubSidebarProps> = ({ subMenus, onSelect, isFocused = false }) => {
  if (!subMenus || subMenus.length === 0) {
    return null;
  }

  const items = subMenus.map(menu => ({
    label: menu.name,
    value: menu.id
  }));

  return (
    <Box 
      flexDirection="column" 
      paddingRight={2} 
      borderStyle="single" 
      borderColor={isFocused ? "blue" : "gray"} 
      width={25}
    >
      <Text bold color="blue">Sub Menu</Text>
      <Box height={1} />
      <SelectInput items={items} onSelect={onSelect} isFocused={isFocused} />
    </Box>
  );
};
