import React, { useState, useEffect, useRef } from 'react';
import { Text, Box, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { musicService, Song } from '../services/music.js';
import { ToolPluginProps } from './types.js';
import { exec, spawn } from 'child_process';
import net from 'net';

export const MusicPlayer: React.FC<ToolPluginProps> = ({ isFocused, onInputFocus }) => {
  const [query, setQuery] = useState(musicService.query);
  const [songs, setSongs] = useState<Song[]>(musicService.songs);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(musicService.selectedIndex);
  const [currentSong, setCurrentSong] = useState<Song | null>(musicService.currentSong);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(musicService.isPlaying);
  const [isPaused, setIsPaused] = useState(musicService.isPaused);
  const [playback, setPlayback] = useState(musicService.playback);
  const [error, setError] = useState<string | null>(null);
  
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const pendingPlayTimeout = useRef<NodeJS.Timeout | null>(null);
  const PIPE_PATH = '\\\\.\\pipe\\mpv-hawk-tui';

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => { musicService.query = query; }, [query]);
  useEffect(() => { musicService.songs = songs; }, [songs]);
  useEffect(() => { musicService.selectedIndex = selectedIndex; }, [selectedIndex]);
  useEffect(() => { musicService.currentSong = currentSong; }, [currentSong]);
  useEffect(() => { musicService.isPlaying = isPlaying; }, [isPlaying]);
  useEffect(() => { musicService.isPaused = isPaused; }, [isPaused]);
  useEffect(() => { musicService.playback = playback; }, [playback]);

  const sendMpvCommand = (command: (string | number)[], callback?: (data: any) => void) => {
    const client = net.connect(PIPE_PATH, () => {
      client.write(JSON.stringify({ command }) + '\n');
      if (!callback) client.end();
    });
    if (callback) {
      client.on('data', (data) => {
        try { const response = JSON.parse(data.toString()); callback(response); } catch (e) {}
        client.end();
      });
    }
    client.on('error', () => {});
  };

  const updatePlaybackStatus = () => {
    if (!isPlaying || isPaused) return;
    sendMpvCommand(['get_property', 'time-pos'], (resPos) => {
      if (resPos?.data !== undefined) {
        const currentTime = resPos.data;
        sendMpvCommand(['get_property', 'duration'], (resDur) => {
          if (resDur?.data !== undefined) {
            setPlayback({ currentTime, duration: resDur.data, percent: (currentTime / resDur.data) * 100 });
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
      setError(null);
    } catch (err) {
      setError('Search failed. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const stopPlayback = () => {
    // 1. Clear any pending play requests
    if (pendingPlayTimeout.current) {
      clearTimeout(pendingPlayTimeout.current);
      pendingPlayTimeout.current = null;
    }

    // 2. Kill current process object if exists
    if (musicService.mpvProcess) {
      try { musicService.mpvProcess.kill('SIGKILL'); } catch (e) {}
      musicService.mpvProcess = null;
    }

    // 3. NUCLEAR OPTION: Kill all mpv processes by name to be 100% sure
    // This is necessary because yt-dlp/mpv sometimes orphans processes on Windows
    exec('taskkill /F /IM mpv.exe /T', () => {});

    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSong(null);
    setPlayback({ currentTime: 0, duration: 0, percent: 0 });
  };

  const playSong = (song: Song) => {
    // Stop everything first
    stopPlayback();

    // Reset UI state immediately
    setCurrentSong(song);
    setIsPlaying(true);
    setIsPaused(false);
    setPlayback({ currentTime: 0, duration: 0, percent: 0 });

    // Schedule new play after a safety delay
    pendingPlayTimeout.current = setTimeout(() => {
      const args = [
        '--no-video',
        '--ytdl-format=bestaudio',
        `--input-ipc-server=${PIPE_PATH}`,
        song.url
      ];

      const child = spawn('mpv', args);
      
      child.on('error', (err) => {
        setIsPlaying(false);
        setError(`Error: Could not start mpv. Make sure it's installed and in PATH.`);
      });

      child.on('exit', () => {
        if (musicService.mpvProcess === child) {
          setIsPlaying(false);
          setIsPaused(false);
          setCurrentSong(null);
          musicService.mpvProcess = null;
          setPlayback({ currentTime: 0, duration: 0, percent: 0 });
        }
      });

      musicService.mpvProcess = child;
      pendingPlayTimeout.current = null;
    }, 500); // Increased delay for stability
  };

  const togglePause = () => {
    if (isPlaying) {
      sendMpvCommand(['cycle', 'pause']);
      setIsPaused(!isPaused);
    }
  };

  const seek = (seconds: number) => {
    if (isPlaying) sendMpvCommand(['seek', seconds]);
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

  useInput((input, key) => {
    if (isSearching) {
      if (key.escape) { setIsSearching(false); onInputFocus?.(false); }
      return;
    }
    if (!isFocused || loading) {
      if (input === '/') { setIsSearching(true); onInputFocus?.(true); }
      return;
    }
    if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
    if (key.downArrow) setSelectedIndex(Math.min(songs.length - 1, selectedIndex + 1));
    if (key.return && songs[selectedIndex]) playSong(songs[selectedIndex]);
    if (input === 'p') togglePause();
    if (key.rightArrow) isPlaying ? seek(10) : null;
    if (key.leftArrow) isPlaying ? seek(-10) : null;
    if (input === 's') stopPlayback();
    if (input === '/') { setIsSearching(true); onInputFocus?.(true); }
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
        <Text bold color="magenta">🎵 My Music Explorer</Text>
        <Text color="gray">/: Search | Enter: Play | p: Pause | s: Stop | ←/→: Seek</Text>
      </Box>
      {error && <Box borderStyle="single" borderColor="red" paddingX={1} marginBottom={1}><Text color="red">{error}</Text></Box>}
      <Box borderStyle="round" borderColor={isSearching ? "magenta" : "gray"} paddingX={1} marginBottom={1}>
        <Text bold color={isSearching ? "magenta" : "white"}>🔍 Search: </Text>
        {isSearching ? <TextInput value={query} onChange={setQuery} onSubmit={handleSearch} /> : <Text color={query ? "white" : "gray"}>{query || "Press '/' to search music..."}</Text>}
      </Box>
      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width={50} borderRightStyle="single" borderColor="gray" paddingRight={1}>
          {loading ? <Text color="yellow">Searching YouTube...</Text> : songs.length > 0 ? songs.map((song, i) => (
            <Box key={song.id}><Text color={i === selectedIndex ? "cyan" : "white"} wrap="truncate-end">{i === selectedIndex ? "> " : "  "}{song.title}</Text></Box>
          )) : <Text italic color="gray">No songs found.</Text>}
        </Box>
        <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
          {currentSong && (
            <Box flexDirection="column" borderStyle="double" borderColor={isPaused ? "yellow" : "green"} paddingX={1} marginBottom={1}>
              <Text bold color={isPaused ? "yellow" : "green"}>{isPaused ? "PAUSED" : "NOW PLAYING (BG)"}</Text>
              <Text bold>{currentSong.title}</Text>
              <Text color="gray" wrap="truncate-end">Artist: {currentSong.author}</Text>
              {renderProgressBar()}
            </Box>
          )}
          {songs[selectedIndex] && (
            <Box flexDirection="column">
              <Text bold underline color="cyan">Song Details</Text>
              <Box marginTop={1}><Text color="gray">Title: </Text><Text>{songs[selectedIndex].title}</Text></Box>
              <Box marginTop={1}><Text color="gray">Duration: </Text><Text color="yellow">{songs[selectedIndex].duration}</Text></Box>
              <Box marginTop={1}><Text color="gray">Channel: </Text><Text color="magenta">{songs[selectedIndex].author}</Text></Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
