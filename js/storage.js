/**
 * AuraWave IndexedDB Storage Engine
 * Manages persistent offline storage for songs, audio blobs, artwork, and playlists.
 */
class AuraStorage {
  constructor() {
    this.dbName = 'AuraWaveDB';
    this.dbVersion = 2;
    this.db = null;
    this.isReady = this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Songs Store
        if (!db.objectStoreNames.contains('songs')) {
          const songStore = db.createObjectStore('songs', { keyPath: 'id' });
          songStore.createIndex('addedAt', 'addedAt', { unique: false });
          songStore.createIndex('isFavorite', 'isFavorite', { unique: false });
          songStore.createIndex('artist', 'artist', { unique: false });
        }

        // Playlists Store
        if (!db.objectStoreNames.contains('playlists')) {
          const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
          playlistStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Settings / Key-Value Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB init error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // --- SONG CRUD ---

  async saveSong(song) {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readwrite');
      const store = tx.objectStore('songs');
      
      const payload = {
        id: song.id,
        title: song.title || 'Untitled Track',
        artist: song.artist || 'Unknown Artist',
        duration: song.duration || 0,
        thumbnailBlob: song.thumbnailBlob || null,
        thumbnailUrl: song.thumbnailUrl || null,
        audioBlob: song.audioBlob, // Full binary Blob
        audioMime: song.audioMime || 'audio/mp4',
        audioFormat: song.audioFormat || 'best',
        bitrate: song.bitrate || '320kbps',
        fileSize: song.audioBlob ? song.audioBlob.size : (song.fileSize || 0),
        addedAt: song.addedAt || Date.now(),
        playCount: song.playCount || 0,
        isFavorite: song.isFavorite || false,
        source: song.source || 'youtube',
        originalUrl: song.originalUrl || ''
      };

      const request = store.put(payload);
      request.onsuccess = () => resolve(payload);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getSong(id) {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllSongs() {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('songs', 'readonly');
      const store = tx.objectStore('songs');
      const request = store.getAll();
      request.onsuccess = () => {
        const songs = request.result || [];
        songs.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
        resolve(songs);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async deleteSong(id) {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['songs', 'playlists'], 'readwrite');
      const songStore = tx.objectStore('songs');
      const playlistStore = tx.objectStore('playlists');

      songStore.delete(id);

      // Remove from any playlists that reference it
      const plRequest = playlistStore.getAll();
      plRequest.onsuccess = () => {
        const playlists = plRequest.result || [];
        playlists.forEach((pl) => {
          if (pl.songIds && pl.songIds.includes(id)) {
            pl.songIds = pl.songIds.filter(sId => sId !== id);
            playlistStore.put(pl);
          }
        });
      };

      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async updateSong(id, updates) {
    await this.isReady;
    const song = await this.getSong(id);
    if (!song) throw new Error('Song not found: ' + id);
    const updated = { ...song, ...updates };
    return this.saveSong(updated);
  }

  async toggleFavorite(id) {
    const song = await this.getSong(id);
    if (!song) return false;
    song.isFavorite = !song.isFavorite;
    await this.saveSong(song);
    return song.isFavorite;
  }

  async incrementPlayCount(id) {
    const song = await this.getSong(id);
    if (!song) return;
    song.playCount = (song.playCount || 0) + 1;
    song.lastPlayedAt = Date.now();
    await this.saveSong(song);
  }

  // --- PLAYLIST CRUD ---

  async savePlaylist(playlist) {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const payload = {
        id: playlist.id || 'pl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        name: playlist.name || 'New Playlist',
        description: playlist.description || '',
        createdAt: playlist.createdAt || Date.now(),
        songIds: playlist.songIds || [],
        coverUrl: playlist.coverUrl || null
      };
      const req = store.put(payload);
      req.onsuccess = () => resolve(payload);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getAllPlaylists() {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getPlaylist(id) {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readonly');
      const store = tx.objectStore('playlists');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async deletePlaylist(id) {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('playlists', 'readwrite');
      const store = tx.objectStore('playlists');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async addSongToPlaylist(playlistId, songId) {
    const pl = await this.getPlaylist(playlistId);
    if (!pl) throw new Error('Playlist not found');
    if (!pl.songIds.includes(songId)) {
      pl.songIds.push(songId);
      await this.savePlaylist(pl);
    }
    return pl;
  }

  async removeSongFromPlaylist(playlistId, songId) {
    const pl = await this.getPlaylist(playlistId);
    if (!pl) return;
    pl.songIds = pl.songIds.filter(id => id !== songId);
    await this.savePlaylist(pl);
    return pl;
  }

  // --- SETTINGS STORE ---

  async getSetting(key, defaultValue = null) {
    await this.isReady;
    return new Promise((resolve) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get(key);
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : defaultValue);
      };
      req.onerror = () => resolve(defaultValue);
    });
  }

  async setSetting(key, value) {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // --- STORAGE STATS & EXPORT ---

  async getStorageStats() {
    await this.isReady;
    const songs = await this.getAllSongs();
    const playlists = await this.getAllPlaylists();
    
    let totalBytes = 0;
    songs.forEach((s) => {
      if (s.fileSize) totalBytes += s.fileSize;
      else if (s.audioBlob) totalBytes += s.audioBlob.size;
    });

    let estimateQuota = 0;
    let estimateUsage = totalBytes;
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        estimateQuota = est.quota || 0;
        if (est.usage) estimateUsage = est.usage;
      } catch (e) {
        console.warn('Storage estimate error:', e);
      }
    }

    return {
      songCount: songs.length,
      playlistCount: playlists.length,
      usedBytes: estimateUsage,
      quotaBytes: estimateQuota,
      usedMB: (estimateUsage / (1024 * 1024)).toFixed(1),
      quotaMB: (estimateQuota / (1024 * 1024)).toFixed(0)
    };
  }

  async clearAllData() {
    await this.isReady;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['songs', 'playlists', 'settings'], 'readwrite');
      tx.objectStore('songs').clear();
      tx.objectStore('playlists').clear();
      tx.objectStore('settings').clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}

// Global Singleton
window.auraStorage = new AuraStorage();
