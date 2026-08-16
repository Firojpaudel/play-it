/**
 * SpotiWave Unified Audio Engine
 * Combines Direct Offline Blob Playback (IndexedDB) + Real YouTube Audio Playback (YT IFrame API)
 * Zero CORS blocking, exact track matching, real-time timestamps, and MediaSession integration.
 */

class AudioPlayer {
  constructor() {
    this.currentTrack = null;
    this.queue = [];
    this.queueIndex = -1;
    this.isPlaying = false;
    this.isShuffle = false;
    this.repeatMode = 'off';
    this.playbackMode = 'yt'; // 'blob' | 'yt'

    // HTML5 Audio for Offline IndexedDB Blobs
    this.blobAudio = new Audio();
    this.blobAudio.preload = 'auto';
    this.currentBlobUrl = null;

    // YouTube Hidden Player
    this.ytPlayer = null;
    this.isYtReady = false;
    this.ytProgressTimer = null;

    this.listeners = {
      play: [],
      pause: [],
      timeupdate: [],
      trackchange: [],
      queuechange: []
    };

    this.initYouTubeIframe();
    this.bindBlobAudioEvents();
    this.setupMediaSession();
  }

  on(event, cb) {
    if (this.listeners[event]) this.listeners[event].push(cb);
  }

  emit(event, data) {
    if (this.listeners[event]) this.listeners[event].forEach(cb => cb(data));
  }

  // --- YOUTUBE IFRAME INITIALIZER ---

  initYouTubeIframe() {
    // Load YouTube IFrame API script
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        this.createYtPlayer();
      };
    } else {
      this.createYtPlayer();
    }
  }

  createYtPlayer() {
    if (this.ytPlayer) return;
    this.ytPlayer = new YT.Player('hidden-yt-player', {
      height: '1',
      width: '1',
      videoId: '',
      playerVars: {
        playsinline: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          this.isYtReady = true;
        },
        onStateChange: (event) => {
          this.handleYtStateChange(event.data);
        }
      }
    });
  }

  handleYtStateChange(state) {
    // YT.PlayerState.PLAYING === 1
    if (state === 1) {
      this.isPlaying = true;
      this.emit('play', this.currentTrack);
      this.updateMediaSessionState('playing');
      this.startYtProgressTracker();
    } 
    // YT.PlayerState.PAUSED === 2
    else if (state === 2) {
      this.isPlaying = false;
      this.emit('pause', this.currentTrack);
      this.updateMediaSessionState('paused');
      this.stopYtProgressTracker();
    }
    // YT.PlayerState.ENDED === 0
    else if (state === 0) {
      this.stopYtProgressTracker();
      this.handleTrackEnded();
    }
  }

  startYtProgressTracker() {
    this.stopYtProgressTracker();
    this.ytProgressTimer = setInterval(() => {
      if (this.playbackMode === 'yt' && this.ytPlayer && typeof this.ytPlayer.getCurrentTime === 'function') {
        const cur = this.ytPlayer.getCurrentTime() || 0;
        const dur = this.ytPlayer.getDuration() || (this.currentTrack ? this.currentTrack.duration : 0);
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        this.emit('timeupdate', { currentTime: cur, duration: dur, percent: pct });
      }
    }, 250);
  }

  stopYtProgressTracker() {
    if (this.ytProgressTimer) {
      clearInterval(this.ytProgressTimer);
      this.ytProgressTimer = null;
    }
  }

  // --- BLOB AUDIO (OFFLINE) EVENTS ---

  bindBlobAudioEvents() {
    this.blobAudio.addEventListener('play', () => {
      if (this.playbackMode === 'blob') {
        this.isPlaying = true;
        this.emit('play', this.currentTrack);
        this.updateMediaSessionState('playing');
      }
    });

    this.blobAudio.addEventListener('pause', () => {
      if (this.playbackMode === 'blob') {
        this.isPlaying = false;
        this.emit('pause', this.currentTrack);
        this.updateMediaSessionState('paused');
      }
    });

    this.blobAudio.addEventListener('timeupdate', () => {
      if (this.playbackMode === 'blob') {
        const cur = this.blobAudio.currentTime || 0;
        const dur = this.blobAudio.duration || (this.currentTrack ? this.currentTrack.duration : 0);
        const pct = dur > 0 ? (cur / dur) * 100 : 0;
        this.emit('timeupdate', { currentTime: cur, duration: dur, percent: pct });
      }
    });

    this.blobAudio.addEventListener('ended', () => {
      if (this.playbackMode === 'blob') {
        this.handleTrackEnded();
      }
    });
  }

  // --- PLAY TRACK ---

  async playTrack(track, newQueue = null, startIndex = -1) {
    if (!track) return;

    if (newQueue) {
      this.queue = [...newQueue];
      this.queueIndex = startIndex >= 0 ? startIndex : this.queue.findIndex(t => t.id === track.id);
      this.emit('queuechange', this.queue);
    } else if (!this.queue.some(t => t.id === track.id)) {
      this.queue.push(track);
      this.queueIndex = this.queue.length - 1;
      this.emit('queuechange', this.queue);
    } else {
      this.queueIndex = this.queue.findIndex(t => t.id === track.id);
    }

    this.currentTrack = { ...track };
    this.emit('trackchange', this.currentTrack);
    this.updateMediaSessionMetadata(this.currentTrack);

    // Stop current audio sources
    this.stopAll();

    // 1. Check if we have an offline binary Blob in IndexedDB
    const stored = await window.auraStorage.getSong(track.id);
    if (stored && stored.audioBlob && stored.audioBlob.size > 5000) {
      this.playbackMode = 'blob';
      if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = URL.createObjectURL(stored.audioBlob);
      this.blobAudio.src = this.currentBlobUrl;
      try {
        await this.blobAudio.play();
        return;
      } catch (err) {
        console.warn('Blob playback error, falling back to stream:', err);
      }
    }

    // 2. Play the EXACT real YouTube audio via Hidden YouTube Engine
    this.playbackMode = 'yt';
    if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
      this.ytPlayer.loadVideoById(track.id);
      this.ytPlayer.playVideo();
    } else {
      setTimeout(() => {
        if (this.ytPlayer && typeof this.ytPlayer.loadVideoById === 'function') {
          this.ytPlayer.loadVideoById(track.id);
          this.ytPlayer.playVideo();
        }
      }, 400);
    }
  }

  stopAll() {
    this.stopYtProgressTracker();
    if (this.ytPlayer && typeof this.ytPlayer.stopVideo === 'function') {
      this.ytPlayer.stopVideo();
    }
    this.blobAudio.pause();
    this.blobAudio.currentTime = 0;
  }

  togglePlay() {
    if (!this.currentTrack) {
      if (this.queue.length > 0) this.playTrack(this.queue[0]);
      else if (window.youtubeEngine.curatedTrending.length > 0) this.playTrack(window.youtubeEngine.curatedTrending[0]);
      return;
    }

    if (this.playbackMode === 'blob') {
      if (this.blobAudio.paused) this.blobAudio.play().catch(e => console.warn(e));
      else this.blobAudio.pause();
    } else {
      if (this.ytPlayer) {
        if (this.isPlaying) this.ytPlayer.pauseVideo();
        else this.ytPlayer.playVideo();
      }
    }
  }

  seek(seconds) {
    if (this.playbackMode === 'blob') {
      this.blobAudio.currentTime = seconds;
    } else if (this.ytPlayer && typeof this.ytPlayer.seekTo === 'function') {
      this.ytPlayer.seekTo(seconds, true);
    }
  }

  seekPercent(percent) {
    const dur = this.getDuration();
    if (dur > 0) {
      this.seek((percent / 100) * dur);
    }
  }

  getDuration() {
    if (this.playbackMode === 'blob') return this.blobAudio.duration || (this.currentTrack ? this.currentTrack.duration : 0);
    if (this.ytPlayer && typeof this.ytPlayer.getDuration === 'function') return this.ytPlayer.getDuration() || (this.currentTrack ? this.currentTrack.duration : 0);
    return this.currentTrack ? this.currentTrack.duration : 0;
  }

  setVolume(fraction) {
    this.blobAudio.volume = fraction;
    if (this.ytPlayer && typeof this.ytPlayer.setVolume === 'function') {
      this.ytPlayer.setVolume(fraction * 100);
    }
  }

  nextTrack() {
    if (this.queue.length === 0) return;
    if (this.isShuffle) {
      const nextIdx = Math.floor(Math.random() * this.queue.length);
      this.queueIndex = nextIdx;
      this.playTrack(this.queue[nextIdx]);
      return;
    }
    if (this.queueIndex < this.queue.length - 1) {
      this.queueIndex++;
      this.playTrack(this.queue[this.queueIndex]);
    } else if (this.repeatMode === 'all') {
      this.queueIndex = 0;
      this.playTrack(this.queue[0]);
    }
  }

  prevTrack() {
    if (this.queue.length === 0) return;
    if (this.queueIndex > 0) {
      this.queueIndex--;
      this.playTrack(this.queue[this.queueIndex]);
    } else {
      this.seek(0);
    }
  }

  handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.seek(0);
      this.togglePlay();
    } else {
      this.nextTrack();
    }
  }

  toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    return this.isShuffle;
  }

  toggleRepeat() {
    const modes = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(this.repeatMode) + 1) % modes.length;
    this.repeatMode = modes[nextIdx];
    return this.repeatMode;
  }

  // --- MEDIASESSION API ---

  setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => this.togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (d.seekTime !== undefined) this.seek(d.seekTime);
    });
  }

  updateMediaSessionMetadata(track) {
    if (!('mediaSession' in navigator) || !track) return;
    let artworkSrc = track.thumbnailUrl || 'icons/icon-512.svg';

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Untitled Track',
      artist: track.artist || 'play-it audio',
      album: 'play-it Library',
      artwork: [
        { src: artworkSrc, sizes: '512x512', type: 'image/png' },
        { src: artworkSrc, sizes: '192x192', type: 'image/png' }
      ]
    });
  }

  updateMediaSessionState(state) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = state;
  }
}

window.audioPlayer = new AudioPlayer();
