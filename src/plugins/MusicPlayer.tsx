import React, { useState, useEffect, useRef } from 'react';
import { Text, Box, Newline, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { musicService, Song } from '../services/music.js';
import { ToolPluginProps } from './types.js';
import { exec, ChildProcess } from 'child_process';

export const MusicPlayer: React.FC<ToolPluginProps> = ({ isFocused, onInputFocus }) => {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const mpvProcess = useRef<ChildProcess | null>(null);

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
    // Kill previous process if exists
    if (mpvProcess.current) {
      mpvProcess.current.kill();
    }

    setCurrentSong(song);
    setIsPlaying(true);

    // Prefer mpv for background play
    // --no-video: only audio
    // --ytdl-format=bestaudio: save bandwidth
    const process = exec(`mpv --no-video --ytdl-format=bestaudio "${song.url}"`, (error) => {
      if (error && !process.killed) {
        setIsPlaying(false);
        // Fallback to browser if mpv is missing
        exec(`start ${song.url}`);
      }
    });

    mpvProcess.current = process;
  };

  const stopPlayback = () => {
    if (mpvProcess.current) {
      mpvProcess.current.kill();
      mpvProcess.current = null;
    }
    setIsPlaying(false);
    setCurrentSong(null);
  };

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
    if (input === 's') stopPlayback();
    if (input === '/') startSearch();
  });

  return (
    <Box flexDirection="column" flexGrow={1} padding={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color="magenta">🎵 My Music Explorer {isPlaying && <Text color="green"> (Playing Background...)</Text>}</Text>
        <Text color="gray">/: Search | Enter: Play | s: Stop | Arrows: Navigate</Text>
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
            <Box flexDirection="column" borderStyle="double" borderColor="green" paddingX={1} marginBottom={1}>
              <Text bold color="green">NOW PLAYING (BG)</Text>
              <Text bold>{currentSong.title}</Text>
              <Text color="gray">Artist: {currentSong.author}</Text>
              <Text color="yellow" dimColor>Press 's' to stop</Text>
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
