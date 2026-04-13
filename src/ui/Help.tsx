import React from 'react';
import { Box, Text } from 'ink';

export const Help: React.FC = () => {
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan" width={60}>
      <Text bold color="cyan">🦅 HAWK TUI HELP</Text>
      <Box height={1} />
      
      <Text bold underline>Global Navigation</Text>
      <Text>  Tab         : Switch focus between Panes</Text>
      <Text>  Arrows      : Move focus or navigate lists</Text>
      <Text>  Right Arrow : Enter sub-menu or content area</Text>
      <Text>  Left Arrow  : Back to sidebar/main menu</Text>
      <Box height={1} />

      <Text bold underline>General Actions</Text>
      <Text>  Enter       : Select item / Confirm</Text>
      <Text>  ESC / b     : Back / Cancel / Clear Error</Text>
      <Text>  h           : Toggle this Help view</Text>
      <Text>  q           : Exit application</Text>
      <Box height={1} />

      <Text bold underline>Git Manager Shortcuts</Text>
      <Text>  1           : Switch to Repo Info</Text>
      <Text>  2           : Switch to Branches list</Text>
      <Text>  3           : Switch to PRs / MRs list</Text>
      <Text>  4           : Switch to Commits history</Text>
      <Box height={1} />

      <Text color="gray" italic>Press 'h' or ESC to close help</Text>
    </Box>
  );
};
