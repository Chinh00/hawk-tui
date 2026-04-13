import yts from 'yt-search';

export interface Song {
  id: string;
  title: string;
  url: string;
  duration: string;
  author: string;
  thumbnail: string;
}

export const musicService = {
  async search(query: string): Promise<Song[]> {
    if (!query) return [];
    const r = await yts(query);
    const videos = r.videos.slice(0, 15);
    
    return videos.map(v => ({
      id: v.videoId,
      title: v.title,
      url: v.url,
      duration: v.timestamp,
      author: v.author.name,
      thumbnail: v.thumbnail
    }));
  }
};
