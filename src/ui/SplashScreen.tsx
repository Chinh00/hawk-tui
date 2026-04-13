import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [progress, setPercent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 5;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [onComplete]);

  const width = 40;
  const filled = Math.round((progress / 100) * width);

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" width="100%" height="100%">
      <Text bold color="green">
        {`
  ██╗  ██╗ █████╗ ██╗    ██╗██╗  ██╗    ████████╗██╗   ██╗██╗
  ██║  ██║██╔══██╗██║    ██║██║ ██╔╝    ╚══██╔══╝██║   ██║██║
  ███████║███████║██║ █╗ ██║█████╔╝        ██║   ██║   ██║██║
  ██╔══██║██╔══██║██║███╗██║██╔═██╗        ██║   ██║   ██║██║
  ██║  ██║██║  ██║╚███╔███╔╝██║  ██╗       ██║   ╚██████╔╝██║
  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚══╝╚══╝ ╚═╝  ╚═╝       ╚═╝    ╚═════╝ ╚═╝
        `}
      </Text>
      
      <Box marginTop={2} flexDirection="column" alignItems="center">
        <Text color="cyan" bold>INITIALIZING HAWK CONTROL CENTER</Text>
        <Box marginTop={1}>
          <Text color="green">[</Text>
          <Text color="green">{'█'.repeat(filled)}</Text>
          <Text color="gray">{'░'.repeat(width - filled)}</Text>
          <Text color="green">]</Text>
          <Text> {progress}%</Text>
        </Box>
        <Text color="gray" dimColor marginTop={1}>Loading system modules and network drivers...</Text>
      </Box>
    </Box>
  );
};
