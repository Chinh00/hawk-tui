import React, { useState, useEffect } from 'react';
import { Text, Box, Newline } from 'ink';
import { simpleGit, StatusResult } from 'simple-git';

const git = simpleGit();

export const GitStatus: React.FC = () => {
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const s = await git.status();
        setStatus(s);
      } catch (e: any) {
        setError(e.message || 'Not a git repository or git not found');
      }
    };

    fetchStatus();
    const timer = setInterval(fetchStatus, 5000);
    return () => clearInterval(timer);
  }, []);

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  if (!status) {
    return <Text color="yellow">Loading git status...</Text>;
  }

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="orange" padding={1}>
      <Text color="blue" bold>Git Status (Auto-refresh 5s)</Text>
      <Newline />
      <Text>Branch: <Text color="magenta">{status.current}</Text></Text>
      <Text>Ahead: {status.ahead} | Behind: {status.behind}</Text>
      <Newline />
      
      {status.files.length === 0 ? (
        <Text color="green">Working tree clean</Text>
      ) : (
        <>
          <Text bold underline>Changed Files:</Text>
          {status.files.map((file, i) => (
            <Box key={i}>
              <Text color={file.index === '?' ? 'red' : 'yellow'}>
                [{file.working_dir || file.index}] {file.path}
              </Text>
            </Box>
          ))}
        </>
      )}
    </Box>
  );
};
