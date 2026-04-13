import React, { useState, useEffect, useRef } from 'react';
import { Text, Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { musicService, Song } from '../services/music.js';
import { ToolPluginProps } from './types.js';
import { exec, spawn, ChildProcess } from 'child_process';
import net from 'net';

interface PlaybackInfo {
  currentTime: number;
  duration: number;
  percent: number;
}

export const MusicPlayer: React.FC<ToolPluginProps> = ({ isFocused, onInputFocus }) => {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playback, setPlayback] = useState<PlaybackInfo>({ currentTime: 0, duration: 0, percent: 0 });
  
  const mpvProcess = useRef<ChildProcess | null>(null);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const PIPE_PATH = '\\\\.\\pipe\\mpv-hawk-tui';

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendMpvCommand = (command: (string | number)[], callback?: (data: any) => void) => {
    const client = net.connect(PIPE_PATH, () => {
      client.write(JSON.stringify({ command }) + '\n');
      if (!callback) client.end();
    });

    if (callback) {
      client.on('data', (data) => {
        try {
          const response = JSON.parse(data.toString());
          callback(response);
        } catch (e) {}
        client.end();
      });
    }

    client.on('error', () => {
      // mpv might not be running or IPC not ready
    });
  };

  const updatePlaybackStatus = () => {
    if (!isPlaying || isPaused) return;

    // Get current position
    sendMpvCommand(['get_property', 'time-pos'], (resPos) => {
      if (resPos.data !== undefined) {
        const currentTime = resPos.data;
        // Get duration
        sendMpvCommand(['get_property', 'duration'], (resDur) => {
          if (resDur.data !== undefined) {
            const duration = resDur.data;
            setPlayback({
              currentTime,
              duration,
              percent: (currentTime / duration) * 100
            });
          }
        });
      }
    });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setIsSearching(false);
    onInputFocus?.(false);
    try {
      const results = await musicService.search(query);
      setSongs(results);
      setSelectedIndex(0);
    } catch (err) {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const startSearch = () => {
    setIsSearching(true);
    onInputFocus?.(true);
  };

  const cancelSearch = () => {
    setIsSearching(false);
    onInputFocus?.(false);
  };

  const playSong = (song: Song) => {
    if (mpvProcess.current) {
      mpvProcess.current.kill();
      mpvProcess.current = null;
    }

    setCurrentSong(song);
    setIsPlaying(true);
    setIsPaused(false);
    setPlayback({ currentTime: 0, duration: 0, percent: 0 });

    const args = [
      '--no-video',
      '--ytdl-format=bestaudio',
      `--input-ipc-server=${PIPE_PATH}`,
      song.url
    ];

    const child = spawn('mpv', args);
    
    child.on('error', () => {
      setIsPlaying(false);
      exec(`start ${song.url}`);
    });

    child.on('exit', () => {
      if (mpvProcess.current === child) {
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentSong(null);
        mpvProcess.current = null;
        setPlayback({ currentTime: 0, duration: 0, percent: 0 });
      }
    });

    mpvProcess.current = child;
  };

  const stopPlayback = () => {
    if (mpvProcess.current) {
      mpvProcess.current.kill();
      mpvProcess.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSong(null);
    setPlayback({ currentTime: 0, duration: 0, percent: 0 });
  };

  const togglePause = () => {
    if (isPlaying) {
      sendMpvCommand(['cycle', 'pause']);
      setIsPaused(!isPaused);
    }
  };

  const seek = (seconds: number) => {
    if (isPlaying) {
      sendMpvCommand(['seek', seconds]);
    }
  };

  useEffect(() => {
    if (isPlaying && !isPaused) {
      pollInterval.current = setInterval(updatePlaybackStatus, 1000);
    } else {
      if (pollInterval.current) clearInterval(pollInterval.current);
    }
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [isPlaying, isPaused]);

  useEffect(() => {
    return () => {
      if (mpvProcess.current) mpvProcess.current.kill();
    };
  }, []);

  useInput((input, key) => {
    if (isSearching) {
      if (key.escape) cancelSearch();
      return;
    }

    if (!isFocused || loading) {
      if (input === '/') startSearch();
      return;
    }

    if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
    if (key.downArrow) setSelectedIndex(Math.min(songs.length - 1, selectedIndex + 1));
    if (key.return && songs[selectedIndex]) playSong(songs[selectedIndex]);
    
    if (input === 'p') togglePause();
    if (key.rightArrow) isPlaying ? seek(10) : null;
    if (key.leftArrow) isPlaying ? seek(-10) : null;
    if (input === 's') stopPlayback();
    if (input === '/') startSearch();
  });

  const renderProgressBar = () => {
    const width = 30;
    const filled = Math.round((playback.percent / 100) * width);
    const empty = width - filled;
    
    return (
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Text color="cyan">[</Text>
          <Text color="green">{'='.repeat(Math.max(0, filled - 1))}</Text>
          <Text color="green">{filled > 0 ? '>' : ''}</Text>
          <Text color="gray">{'-'.repeat(empty)}</Text>
          <Text color="cyan">]</Text>
          <Text> {formatTime(playback.currentTime)} / {formatTime(playback.duration)}</Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="magenta">
          🎵 My Music Explorer {isPlaying && (
            <Text color={isPaused ? "yellow" : "green"}> 
              ({isPaused ? "Paused" : "Playing Background..."})
            </Text>
          )}
        </Text>
        <Text color="gray">/: Search | Enter: Play | p: Pause | s: Stop | ←/→: Seek</Text>
      </Box>

      {/* Search Bar */}
      <Box borderStyle="round" borderColor={isSearching ? "magenta" : "gray"} paddingX={1} marginBottom={1}>
        <Text bold color={isSearching ? "magenta" : "white"}>🔍 Search: </Text>
        {isSearching ? (
          <TextInput 
            value={query} 
            onChange={setQuery} 
            onSubmit={handleSearch} 
          />
        ) : (
          <Text color={query ? "white" : "gray"}>{query || "Press '/' to search music..."}</Text>
        )}
      </Box>

      <Box flexDirection="row" flexGrow={1}>
        {/* Songs List */}
        <Box flexDirection="column" width={50} borderRightStyle="single" borderColor="gray" paddingRight={1}>
          {loading ? (
            <Text color="yellow">Searching YouTube...</Text>
          ) : songs.length > 0 ? (
            songs.map((song, i) => (
              <Box key={song.id}>
                <Text color={i === selectedIndex ? "cyan" : "white"} wrap="truncate-end">
                  {i === selectedIndex ? "> " : "  "}{song.title}
                </Text>
              </Box>
            ))
          ) : (
            <Text italic color="gray">No songs found. Try searching something!</Text>
          )}
        </Box>

        {/* Playback & Details */}
        <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
          {currentSong && (
            <Box flexDirection="column" borderStyle="double" borderColor={isPaused ? "yellow" : "green"} paddingX={1} marginBottom={1}>
              <Text bold color={isPaused ? "yellow" : "green"}>{isPaused ? "PAUSED" : "NOW PLAYING (BG)"}</Text>
              <Text bold>{currentSong.title}</Text>
              <Text color="gray" wrap="truncate-end">Artist: {currentSong.author}</Text>
              
              {renderProgressBar()}

              <Box marginTop={1}>
                <Text color="gray">Controls: </Text>
                <Text color="cyan">p (pause) | ←/→ (seek) | s (stop)</Text>
              </Box>
            </Box>
          )}

          {songs[selectedIndex] && (
            <Box flexDirection="column">
              <Text bold underline color="cyan">Song Details</Text>
              <Box marginTop={1}>
                <Text color="gray">Title: </Text>
                <Text>{songs[selectedIndex].title}</Text>
              </Box>
              <Box marginTop={1}>
                <Text color="gray">Duration: </Text>
                <Text color="yellow">{songs[selectedIndex].duration}</Text>
              </Box>
              <Box marginTop={1}>
                <Text color="gray">Channel: </Text>
                <Text color="magenta">{songs[selectedIndex].author}</Text>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
