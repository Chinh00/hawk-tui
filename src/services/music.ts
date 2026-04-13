import yts from 'yt-search';
import { ChildProcess } from 'child_process';

export interface Song {
  id: string;
  title: string;
  url: string;
  duration: string;
  author: string;
  thumbnail: string;
}

interface PlaybackInfo {
  currentTime: number;
  duration: number;
  percent: number;
}

// Singleton state to preserve across tab switches
class MusicService {
  private _query = '';
  private _songs: Song[] = [];
  private _selectedIndex = 0;
  private _currentSong: Song | null = null;
  private _isPlaying = false;
  private _isPaused = false;
  private _playback: PlaybackInfo = { currentTime: 0, duration: 0, percent: 0 };
  
  public mpvProcess: ChildProcess | null = null;

  get query() { return this._query; }
  set query(v) { this._query = v; }

  get songs() { return this._songs; }
  set songs(v) { this._songs = v; }

  get selectedIndex() { return this._selectedIndex; }
  set selectedIndex(v) { this._selectedIndex = v; }

  get currentSong() { return this._currentSong; }
  set currentSong(v) { this._currentSong = v; }

  get isPlaying() { return this._isPlaying; }
  set isPlaying(v) { this._isPlaying = v; }

  get isPaused() { return this._isPaused; }
  set isPaused(v) { this._isPaused = v; }

  get playback() { return this._playback; }
  set playback(v) { this._playback = v; }

  async search(query: string): Promise<Song[]> {
    if (!query) return [];
    this._query = query;
    const r = await yts(query);
    const videos = r.videos.slice(0, 15);
    
    this._songs = videos.map(v => ({
      id: v.videoId,
      title: v.title,
      url: v.url,
      duration: v.timestamp,
      author: v.author.name,
      thumbnail: v.thumbnail
    }));
    return this._songs;
  }
}

export const musicService = new MusicService();
