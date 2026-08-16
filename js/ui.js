/**
 * SpotiWave UI Controller
 * Dynamic rendering for Home, Quick Picks, YouTube Search, Shelves, Offline Library,
 * and Smart 1-Tap Vocal Lyrics Synchronizer.
 */

class UIController {
  constructor() {
    this.activeTab = 'home';
    this.searchDebounceTimer = null;
    this.activeDownloads = new Map();
    this.cachedSongs = [];
    this.currentLyrics = null;
    this.activeLyricIndex = -1;
    this.lyricsOffset = 0; // In seconds

    this.categories = [
      { name: 'Pop', color: '#8d67ab', query: 'Top Pop Hits 2024', img: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop&auto=format&q=80' },
      { name: 'Hip-Hop', color: '#ba5d07', query: 'Hip Hop Rap Hits', img: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&h=300&fit=crop&auto=format&q=80' },
      { name: 'Lo-Fi Chill', color: '#477d95', query: 'lofi hip hop beats', img: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=300&h=300&fit=crop&auto=format&q=80' },
      { name: 'Rock', color: '#e91429', query: 'Rock Classics playlist', img: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop&auto=format&q=80' },
      { name: 'Dance / EDM', color: '#1e3264', query: 'EDM Festival Party playlist', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop&auto=format&q=80' },
      { name: 'Acoustic', color: '#148a08', query: 'Acoustic calm peaceful songs', img: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=300&h=300&fit=crop&auto=format&q=80' },
      { name: 'Workout', color: '#b02897', query: 'Workout Gym Motivation playlist', img: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=300&h=300&fit=crop&auto=format&q=80' },
      { name: 'Gaming / Synth', color: '#503750', query: 'Synthwave Gaming beats', img: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&h=300&fit=crop&auto=format&q=80' }
    ];
  }

  init() {
    this.updateGreeting();
    this.renderQuickPicks();
    this.renderHomeShelves();
    this.renderCategories();
    this.bindSearchEvents();
    this.bindPlayerEvents();
    this.refreshLibrary();
  }

  updateGreeting() {
    const el = document.getElementById('greeting-text');
    if (!el) return;
    const hour = new Date().getHours();
    if (hour < 12) el.textContent = 'Good morning';
    else if (hour < 18) el.textContent = 'Good afternoon';
    else el.textContent = 'Good evening';
  }

  // --- NAVIGATION TABS ---

  switchTab(tabName) {
    this.activeTab = tabName;

    document.querySelectorAll('.sidebar-nav-item, .mobile-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.view-page').forEach(page => {
      page.classList.remove('active');
    });

    const activePage = document.getElementById(`view-${tabName}`);
    if (activePage) activePage.classList.add('active');

    if (tabName === 'home') {
      this.renderQuickPicks();
      this.renderHomeShelves();
    } else if (tabName === 'library') {
      this.refreshLibrary();
    } else if (tabName === 'settings') {
      this.refreshSettings();
    }
  }

  // --- HOME FEED & SHELVES ---

  renderQuickPicks() {
    const container = document.getElementById('quick-picks-container');
    if (!container) return;

    const curated = window.youtubeEngine.curatedTrending.slice(0, 6);
    container.innerHTML = curated.map((track) => `
      <div class="quick-pick-card" onclick="window.ui.streamOrPlayTrack('${track.id}', '${this.escapeAttr(track.title)}', '${this.escapeAttr(track.artist)}', ${track.duration}, '${this.escapeAttr(track.thumbnailUrl)}')">
        <img class="quick-pick-img" src="${track.thumbnailUrl}" alt="" loading="lazy"/>
        <span class="quick-pick-title">${this.escapeHtml(track.title)}</span>
        <button class="quick-pick-play" title="Play">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </button>
      </div>
    `).join('');
  }

  renderHomeShelves() {
    const hitsContainer = document.getElementById('shelf-hits');
    const lofiContainer = document.getElementById('shelf-lofi');

    if (hitsContainer) {
      const hits = window.youtubeEngine.curatedTrending.slice(1, 6);
      hitsContainer.innerHTML = hits.map(track => `
        <div class="media-card" onclick="window.ui.streamOrPlayTrack('${track.id}', '${this.escapeAttr(track.title)}', '${this.escapeAttr(track.artist)}', ${track.duration}, '${this.escapeAttr(track.thumbnailUrl)}')">
          <div class="media-card-img-wrap">
            <img class="media-card-img" src="${track.thumbnailUrl}" alt="" loading="lazy"/>
            <button class="media-card-play-btn" title="Play">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
          <div class="media-card-title">${this.escapeHtml(track.title)}</div>
          <div class="media-card-artist">${this.escapeHtml(track.artist)}</div>
        </div>
      `).join('');
    }

    if (lofiContainer) {
      const lofi = [window.youtubeEngine.curatedTrending[0], ...window.youtubeEngine.curatedTrending.slice(4, 6)];
      lofiContainer.innerHTML = lofi.map(track => `
        <div class="media-card" onclick="window.ui.streamOrPlayTrack('${track.id}', '${this.escapeAttr(track.title)}', '${this.escapeAttr(track.artist)}', ${track.duration}, '${this.escapeAttr(track.thumbnailUrl)}')">
          <div class="media-card-img-wrap">
            <img class="media-card-img" src="${track.thumbnailUrl}" alt="" loading="lazy"/>
            <button class="media-card-play-btn" title="Play">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
          </div>
          <div class="media-card-title">${this.escapeHtml(track.title)}</div>
          <div class="media-card-artist">${this.escapeHtml(track.artist)}</div>
        </div>
      `).join('');
    }
  }

  // --- BROWSE CATEGORIES ---

  renderCategories() {
    const container = document.getElementById('browse-categories');
    if (!container) return;

    container.innerHTML = this.categories.map(cat => `
      <div class="category-tile" style="background-color: ${cat.color};" onclick="window.ui.triggerCategorySearch('${cat.query}')">
        <span class="category-title">${cat.name}</span>
        <img src="${cat.img}" style="position: absolute; right: -12px; bottom: -8px; width: 68px; height: 68px; transform: rotate(25deg); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" alt=""/>
      </div>
    `).join('');
  }

  triggerCategorySearch(query) {
    this.switchTab('search');
    const searchInput = document.getElementById('header-search-input');
    if (searchInput) {
      searchInput.value = query;
      this.executeSearch(query);
    }
  }

  // --- SEARCH ENGINE BINDINGS ---

  bindSearchEvents() {
    const searchInputs = [
      document.getElementById('header-search-input'),
      document.getElementById('mobile-search-input')
    ].filter(Boolean);

    searchInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (this.activeTab !== 'search') {
          this.switchTab('search');
        }

        // Sync inputs
        searchInputs.forEach(other => { if (other !== input) other.value = val; });

        clearTimeout(this.searchDebounceTimer);
        if (val.length > 0) {
          this.searchDebounceTimer = setTimeout(() => {
            this.executeSearch(val);
          }, 350);
        } else {
          this.clearSearchResults();
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(this.searchDebounceTimer);
          this.executeSearch(input.value.trim());
        }
      });
    });
  }

  async executeSearch(query) {
    const resultsContainer = document.getElementById('search-results-container');
    const categoriesSection = document.getElementById('browse-categories-section');
    if (!resultsContainer) return;

    if (categoriesSection) categoriesSection.style.display = 'none';
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 0; color: var(--text-subdued);">
        <div class="spinner" style="width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.2); border-top-color: var(--sp-green); border-radius: 50%; animation: spin 0.6s linear infinite; margin: 0 auto 12px auto;"></div>
        Searching YouTube...
      </div>
    `;

    try {
      const results = await window.youtubeEngine.search(query);
      this.renderSearchResults(results);
    } catch (err) {
      this.renderSearchResults(window.youtubeEngine.curatedTrending);
    }
  }

  renderSearchResults(items) {
    const container = document.getElementById('search-results-container');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `<div style="padding: 40px 0; color: var(--text-subdued); text-align: center;">No results found.</div>`;
      return;
    }

    let html = `
      <table class="track-table">
        <thead>
          <tr class="track-table-header">
            <th class="table-col-num">#</th>
            <th>Title</th>
            <th class="table-col-duration">Duration</th>
            <th class="table-col-actions">Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    items.forEach((item, idx) => {
      html += `
        <tr class="track-table-row" onclick="window.ui.streamOrPlayTrack('${item.id}', '${this.escapeAttr(item.title)}', '${this.escapeAttr(item.artist)}', ${item.duration || 0}, '${this.escapeAttr(item.thumbnailUrl)}')">
          <td class="table-col-num">${idx + 1}</td>
          <td>
            <div class="table-col-track">
              <img class="table-track-thumb" src="${item.thumbnailUrl || 'icons/icon-512.svg'}" alt="" loading="lazy"/>
              <div class="table-track-info">
                <span class="table-track-title">${this.escapeHtml(item.title)}</span>
                <span class="table-track-artist">${this.escapeHtml(item.artist)}</span>
              </div>
            </div>
          </td>
          <td class="table-col-duration">${item.durationStr || window.youtubeEngine.formatDuration(item.duration)}</td>
          <td class="table-col-actions" onclick="event.stopPropagation()">
            <button class="table-download-btn" onclick="window.ui.startTrackDownload('${item.id}', '${this.escapeAttr(item.title)}', '${this.escapeAttr(item.artist)}', ${item.duration || 0}, '${this.escapeAttr(item.thumbnailUrl)}')">
              Download
            </button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  clearSearchResults() {
    const container = document.getElementById('search-results-container');
    const categoriesSection = document.getElementById('browse-categories-section');
    if (container) container.innerHTML = '';
    if (categoriesSection) categoriesSection.style.display = 'block';
  }

  // --- STREAMING & OFFLINE DOWNLOADS ---

  async streamOrPlayTrack(id, title, artist, duration, thumbUrl) {
    const stored = await window.auraStorage.getSong(id);
    if (stored) {
      window.audioPlayer.playTrack(stored);
      this.showToast(`Playing "${title}" (Offline)`, 'success');
    } else {
      const track = { id, title, artist, duration: duration || 0, thumbnailUrl: thumbUrl, isOnlineStream: true };
      window.audioPlayer.playTrack(track);
    }

    // Load lyrics and retrieve saved custom offset for this track (if any)
    const savedOffset = await window.auraStorage.getSetting('lyric_offset_' + id, 0);
    this.lyricsOffset = parseFloat(savedOffset) || 0;
    this.updateOffsetDisplay();
    this.loadLyricsForCurrentTrack(title, artist);
  }

  async downloadCurrentPlayingTrack() {
    const current = window.audioPlayer.currentTrack;
    if (!current) {
      this.showToast('No track playing to download', 'info');
      return;
    }
    this.startTrackDownload(current.id, current.title, current.artist, current.duration, current.thumbnailUrl);
  }

  async startTrackDownload(id, title, artist, duration, thumbUrl) {
    // 1. Check if already saved in IndexedDB
    const existing = await window.auraStorage.getSong(id);
    if (existing && existing.audioBlob) {
      this.showToast(`✓ "${title}" is already saved in your Library!`, 'success');
      this.refreshLibrary();
      return;
    }

    if (this.activeDownloads.has(id)) {
      this.showToast(`Already downloading "${title}"...`, 'info');
      return;
    }

    this.activeDownloads.set(id, { id, title, percent: 15, status: 'Starting...' });
    this.updateDownloadQueueUI();
    this.updatePlayerDownloadBtnState(true);
    this.showToast(`Downloading "${title}" for Offline Library...`, 'info');

    try {
      const res = await window.youtubeEngine.downloadAudioTrack(id, (percent, status) => {
        this.activeDownloads.set(id, { id, title, percent, status });
        this.updateDownloadQueueUI();
      });

      const songRecord = {
        id,
        title,
        artist,
        duration: duration || 0,
        audioBlob: res.audioBlob,
        audioMime: res.audioMime,
        audioFormat: 'mp3',
        bitrate: res.bitrate || '320 kbps (High Fidelity)',
        thumbnailBlob: res.thumbnailBlob,
        thumbnailUrl: thumbUrl,
        addedAt: Date.now()
      };

      await window.auraStorage.saveSong(songRecord);
      this.showToast(`✓ "${title}" saved to Offline Library!`, 'success');
      this.refreshLibrary();
    } catch (err) {
      console.warn('Download notice:', err);
    } finally {
      this.activeDownloads.delete(id);
      this.updateDownloadQueueUI();
      this.updatePlayerDownloadBtnState(false, true);
    }
  }

  async updatePlayerDownloadBtnState(isDownloading, isSaved = false) {
    const btn = document.getElementById('save-current-offline-btn');
    const fullBtn = document.getElementById('full-download-btn');

    if (isDownloading) {
      const spinSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 0.8s linear infinite; color: var(--sp-green);"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/></svg>`;
      if (btn) { btn.innerHTML = spinSvg; btn.title = 'Downloading audio...'; }
      if (fullBtn) { fullBtn.innerHTML = spinSvg; fullBtn.title = 'Downloading...'; }
      return;
    }

    // Check if current track is saved
    const curTrack = window.audioPlayer.currentTrack;
    let saved = isSaved;
    if (curTrack && !saved) {
      const exist = await window.auraStorage.getSong(curTrack.id);
      if (exist) saved = true;
    }

    if (saved) {
      const checkSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--sp-green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      if (btn) { btn.innerHTML = checkSvg; btn.title = 'Saved to Offline Library'; }
      if (fullBtn) { fullBtn.innerHTML = checkSvg; fullBtn.title = 'Saved Offline'; }
    } else {
      const dlSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      if (btn) { btn.innerHTML = dlSvg; btn.title = 'Download for Offline'; }
      if (fullBtn) { fullBtn.innerHTML = dlSvg; fullBtn.title = 'Download Song'; }
    }
  }

  updateDownloadQueueUI() {
    const queuePanel = document.getElementById('active-download-queue');
    if (!queuePanel) return;

    const count = this.activeDownloads.size;
    if (count === 0) {
      queuePanel.style.display = 'none';
      queuePanel.innerHTML = '';
      return;
    }

    queuePanel.style.display = 'block';
    let html = `
      <div class="download-queue-header">
        <div class="download-queue-title">
          <span>Downloading High-Fidelity Audio (${count} active)</span>
        </div>
      </div>
    `;

    this.activeDownloads.forEach(item => {
      html += `
        <div class="download-item-row">
          <div class="download-item-top">
            <span class="download-item-title">${this.escapeHtml(item.title)}</span>
            <span class="download-item-status">${item.status || item.percent + '%'}</span>
          </div>
          <div class="download-progress-bar">
            <div class="download-progress-fill" style="width: ${item.percent}%"></div>
          </div>
        </div>
      `;
    });

    queuePanel.innerHTML = html;
  }

  // --- SMART VOCAL LYRICS SYNCHRONIZER ---

  async loadLyricsForCurrentTrack(title, artist) {
    this.activeLyricIndex = -1;
    const scrollContainer = document.getElementById('lyrics-scroll-container');
    if (scrollContainer) {
      scrollContainer.innerHTML = '<div style="color: var(--text-subdued); text-align: center; padding: 80px 0; font-size: 16px;">Searching lyrics...</div>';
    }

    this.currentLyrics = await window.youtubeEngine.fetchLyrics(title, artist);
    this.renderLyrics();
  }

  renderLyrics() {
    const scrollContainer = document.getElementById('lyrics-scroll-container');
    if (!scrollContainer || !this.currentLyrics) return;

    if (this.currentLyrics.type === 'synced' && this.currentLyrics.lyrics.length > 0) {
      scrollContainer.innerHTML = this.currentLyrics.lyrics.map((l, idx) => `
        <div class="lyric-line" id="lyric-line-${idx}" data-time="${l.time}" onclick="window.audioPlayer.seek(${l.time})">
          ${this.escapeHtml(l.text)}
        </div>
      `).join('');
    } else {
      scrollContainer.innerHTML = `
        <div style="font-size: 22px; font-weight: 800; line-height: 1.8; color: #fff; text-align: center; max-width: 600px; padding: 40px 0;">
          ${this.escapeHtml(this.currentLyrics.text || 'Lyrics not available for this song')}
        </div>
      `;
    }
  }

  /**
   * 1-Tap Smart Vocal Sync:
   * The user taps "Sync at Current Vocal", and all lyrics automatically shift to match the exact vocal start!
   */
  async syncLyricsAtCurrentVocal() {
    if (!this.currentLyrics || this.currentLyrics.type !== 'synced' || !this.currentLyrics.lyrics.length) {
      this.showToast('No timestamped lyrics to calibrate', 'info');
      return;
    }

    const currentTrack = window.audioPlayer.currentTrack;
    if (!currentTrack) return;

    let curTime = 0;
    if (window.audioPlayer.playbackMode === 'blob') {
      curTime = window.audioPlayer.blobAudio.currentTime;
    } else if (window.audioPlayer.ytPlayer && typeof window.audioPlayer.ytPlayer.getCurrentTime === 'function') {
      curTime = window.audioPlayer.ytPlayer.getCurrentTime();
    }

    // First lyric timestamp
    const firstLyricTime = this.currentLyrics.lyrics[0].time;
    // Offset is intro delay: curTime - firstLyricTime
    this.lyricsOffset = curTime - firstLyricTime;

    this.updateOffsetDisplay();
    this.showToast(`✓ Synced: Vocals locked to ${window.youtubeEngine.formatDuration(curTime)}!`, 'success');

    // Save offset permanently for this track in IndexedDB
    if (currentTrack.id) {
      await window.auraStorage.setSetting('lyric_offset_' + currentTrack.id, this.lyricsOffset);
    }

    this.updateLyricsHighlight(curTime);
  }

  adjustLyricsOffset(delta) {
    this.lyricsOffset = (this.lyricsOffset || 0) + delta;
    this.updateOffsetDisplay();

    const currentTrack = window.audioPlayer.currentTrack;
    if (currentTrack && currentTrack.id) {
      window.auraStorage.setSetting('lyric_offset_' + currentTrack.id, this.lyricsOffset);
    }

    if (window.audioPlayer) {
      const cur = window.audioPlayer.playbackMode === 'blob' ? window.audioPlayer.blobAudio.currentTime : (window.audioPlayer.ytPlayer?.getCurrentTime?.() || 0);
      this.updateLyricsHighlight(cur);
    }
  }

  updateOffsetDisplay() {
    const el = document.getElementById('lyrics-offset-display');
    if (el) {
      const val = this.lyricsOffset || 0;
      el.textContent = `${val > 0 ? '+' : ''}${val.toFixed(1)}s`;
    }
  }

  updateLyricsHighlight(currentTime) {
    if (!this.currentLyrics || this.currentLyrics.type !== 'synced' || !this.currentLyrics.lyrics) return;

    const lyrics = this.currentLyrics.lyrics;
    // Effective time adjusted for video intro offset
    const effectiveTime = currentTime - (this.lyricsOffset || 0);

    let activeIdx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (effectiveTime >= lyrics[i].time) {
        activeIdx = i;
      } else {
        break;
      }
    }

    if (activeIdx !== this.activeLyricIndex) {
      this.activeLyricIndex = activeIdx;
      const lines = document.querySelectorAll('.lyric-line');
      lines.forEach((line, idx) => {
        const isActive = idx === activeIdx;
        const isPassed = idx < activeIdx;
        line.classList.toggle('active', isActive);
        line.classList.toggle('passed', isPassed);
      });

      if (activeIdx >= 0) {
        const activeElem = document.getElementById(`lyric-line-${activeIdx}`);
        const scrollContainer = document.getElementById('lyrics-scroll-container');
        if (activeElem && scrollContainer) {
          const containerHeight = scrollContainer.clientHeight;
          const elemTop = activeElem.offsetTop;
          const elemHeight = activeElem.clientHeight;
          scrollContainer.scrollTo({
            top: elemTop - (containerHeight / 2) + (elemHeight / 2),
            behavior: 'smooth'
          });
        }
      }
    }
  }

  openLyrics() {
    const modal = document.getElementById('lyrics-modal');
    if (modal) modal.classList.add('open');
  }

  closeLyrics() {
    const modal = document.getElementById('lyrics-modal');
    if (modal) modal.classList.remove('open');
  }

  // --- OFFLINE LIBRARY ---

  async refreshLibrary() {
    const container = document.getElementById('library-track-list');
    const emptyState = document.getElementById('library-empty-state');
    if (!container) return;

    const songs = await window.auraStorage.getAllSongs();
    this.cachedSongs = songs;

    if (songs.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    let html = `
      <table class="track-table">
        <thead>
          <tr class="track-table-header">
            <th class="table-col-num">#</th>
            <th>Title</th>
            <th class="table-col-duration">Duration</th>
            <th class="table-col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    songs.forEach((s, idx) => {
      let thumbSrc = s.thumbnailUrl || 'icons/icon-512.svg';
      if (s.thumbnailBlob) thumbSrc = URL.createObjectURL(s.thumbnailBlob);

      html += `
        <tr class="track-table-row" onclick="window.audioPlayer.playTrack(window.ui.cachedSongs[${idx}], window.ui.cachedSongs, ${idx})">
          <td class="table-col-num">${idx + 1}</td>
          <td>
            <div class="table-col-track">
              <img class="table-track-thumb" src="${thumbSrc}" alt=""/>
              <div class="table-track-info">
                <span class="table-track-title">${this.escapeHtml(s.title)}</span>
                <span class="table-track-artist">${this.escapeHtml(s.artist)} • <span style="color: var(--sp-green);">${s.bitrate || '320 kbps'}</span></span>
              </div>
            </div>
          </td>
          <td class="table-col-duration">${window.youtubeEngine.formatDuration(s.duration)}</td>
          <td class="table-col-actions" onclick="event.stopPropagation()">
            <div style="display: inline-flex; align-items: center; gap: 4px;">
              <button class="icon-btn" title="Export MP3 to iPhone Files" onclick="window.ui.exportOfflineTrack('${s.id}', event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </button>
              <button class="icon-btn" title="Delete Song" onclick="window.ui.deleteOfflineTrack('${s.id}', event)">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async exportOfflineTrack(id, event) {
    if (event) event.stopPropagation();
    const song = await window.auraStorage.getSong(id);
    if (!song) return;

    if (song.audioBlob) {
      const url = URL.createObjectURL(song.audioBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title || 'track'} - ${song.artist || 'SpotiWave'}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      this.showToast(`✓ Exported "${song.title}.mp3" to device!`, 'success');
    } else {
      window.open(`https://inv.nadeko.net/latest_version?id=${id}&itag=140`, '_blank');
      this.showToast(`Opening direct MP3 download stream...`, 'info');
    }
  }

  async deleteOfflineTrack(id, event) {
    if (event) event.stopPropagation();
    try {
      await window.auraStorage.deleteSong(id);
      this.showToast('✓ Song removed from offline storage', 'info');
      await this.refreshLibrary();
    } catch (err) {
      console.error('Delete error:', err);
    }
  }

  // --- SETTINGS ---

  async refreshSettings() {
    const statsContainer = document.getElementById('storage-stats-container');
    if (!statsContainer) return;

    const stats = await window.auraStorage.getStorageStats();
    statsContainer.innerHTML = `
      <div class="storage-meter">
        <div class="storage-meter-header">
          <span>iPhone / Device Offline Storage</span>
          <span style="color: var(--sp-green);">${stats.usedMB} MB used</span>
        </div>
        <div class="storage-bar">
          <div class="storage-bar-fill" style="width: ${Math.min(100, Math.max(3, (stats.usedBytes / (1024 * 1024 * 500)) * 100))}%;"></div>
        </div>
        <div style="font-size: 12px; color: var(--text-subdued); margin-top: 8px;">
          ${stats.songCount} offline songs saved for Airplane Mode & zero-data listening.
        </div>
      </div>
    `;
  }

  // --- PLAYER UI BINDINGS & PROGRESS BAR FILL ---

  bindPlayerEvents() {
    const player = window.audioPlayer;

    const barPlayBtn = document.getElementById('main-play-btn-bar');
    const barPrevBtn = document.getElementById('prev-btn-bar');
    const barNextBtn = document.getElementById('next-btn-bar');
    const barShuffleBtn = document.getElementById('shuffle-btn-bar');
    const barRepeatBtn = document.getElementById('repeat-btn-bar');
    const barSlider = document.getElementById('player-slider-bar');
    const barTimeCur = document.getElementById('player-time-current');
    const barTimeDur = document.getElementById('player-time-duration');
    const barTitle = document.getElementById('player-title');
    const barArtist = document.getElementById('player-artist');
    const barThumb = document.getElementById('player-thumb');
    const volumeSlider = document.getElementById('volume-slider');

    const miniPlayBtn = document.getElementById('mini-play-btn');
    const fullPlayBtn = document.getElementById('full-play-btn');
    const fullPrevBtn = document.getElementById('prev-track-btn');
    const fullNextBtn = document.getElementById('next-track-btn');
    const fullShuffleBtn = document.getElementById('shuffle-btn');
    const fullRepeatBtn = document.getElementById('repeat-btn');
    const scrubSlider = document.getElementById('scrub-slider');
    const fullTimeCur = document.getElementById('current-time-text');
    const fullTimeDur = document.getElementById('total-duration-text');

    const handlePlayPause = () => player.togglePlay();
    if (barPlayBtn) barPlayBtn.addEventListener('click', handlePlayPause);
    if (miniPlayBtn) miniPlayBtn.addEventListener('click', (e) => { e.stopPropagation(); handlePlayPause(); });
    if (fullPlayBtn) fullPlayBtn.addEventListener('click', handlePlayPause);

    if (barPrevBtn) barPrevBtn.addEventListener('click', () => player.prevTrack());
    if (fullPrevBtn) fullPrevBtn.addEventListener('click', () => player.prevTrack());
    if (barNextBtn) barNextBtn.addEventListener('click', () => player.nextTrack());
    if (fullNextBtn) fullNextBtn.addEventListener('click', () => player.nextTrack());

    const handleShuffle = () => {
      const isShuffle = player.toggleShuffle();
      if (barShuffleBtn) barShuffleBtn.classList.toggle('active', isShuffle);
      if (fullShuffleBtn) fullShuffleBtn.classList.toggle('active', isShuffle);
    };
    if (barShuffleBtn) barShuffleBtn.addEventListener('click', handleShuffle);
    if (fullShuffleBtn) fullShuffleBtn.addEventListener('click', handleShuffle);

    const handleRepeat = () => {
      const mode = player.toggleRepeat();
      if (barRepeatBtn) barRepeatBtn.classList.toggle('active', mode !== 'off');
      if (fullRepeatBtn) fullRepeatBtn.classList.toggle('active', mode !== 'off');
    };
    if (barRepeatBtn) barRepeatBtn.addEventListener('click', handleRepeat);
    if (fullRepeatBtn) fullRepeatBtn.addEventListener('click', handleRepeat);

    const applySliderProgress = (slider, percent) => {
      slider.style.background = `linear-gradient(to right, #1ed760 0%, #1ed760 ${percent}%, rgba(255,255,255,0.2) ${percent}%, rgba(255,255,255,0.2) 100%)`;
    };

    if (barSlider) {
      barSlider.addEventListener('input', (e) => {
        applySliderProgress(barSlider, parseFloat(e.target.value));
      });
      barSlider.addEventListener('change', (e) => {
        player.seekPercent(parseFloat(e.target.value));
      });
    }

    if (scrubSlider) {
      scrubSlider.addEventListener('input', (e) => {
        applySliderProgress(scrubSlider, parseFloat(e.target.value));
      });
      scrubSlider.addEventListener('change', (e) => {
        player.seekPercent(parseFloat(e.target.value));
      });
    }

    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) / 100;
        player.setVolume(val);
        applySliderProgress(volumeSlider, parseFloat(e.target.value));
      });
      applySliderProgress(volumeSlider, 100);
    }

    player.on('trackchange', (track) => {
      if (!track) return;

      let thumbSrc = track.thumbnailUrl || 'icons/icon-512.svg';
      if (track.thumbnailBlob) thumbSrc = URL.createObjectURL(track.thumbnailBlob);

      if (barTitle) barTitle.textContent = track.title;
      if (barArtist) barArtist.textContent = track.artist;
      if (barThumb) barThumb.src = thumbSrc;

      const miniTitle = document.getElementById('mini-title');
      const miniArtist = document.getElementById('mini-artist');
      const miniThumb = document.getElementById('mini-thumbnail');
      const miniPlayer = document.getElementById('mini-player');
      if (miniTitle) miniTitle.textContent = track.title;
      if (miniArtist) miniArtist.textContent = track.artist;
      if (miniThumb) miniThumb.src = thumbSrc;
      if (miniPlayer) miniPlayer.classList.add('visible');

      const fullTitle = document.getElementById('full-title');
      const fullArtist = document.getElementById('full-artist');
      const fullArtwork = document.getElementById('full-artwork');
      if (fullTitle) fullTitle.textContent = track.title;
      if (fullArtist) fullArtist.textContent = track.artist;
      if (fullArtwork) fullArtwork.src = thumbSrc;
    });

    player.on('play', () => this.updatePlayStateUI(true));
    player.on('pause', () => this.updatePlayStateUI(false));

    player.on('timeupdate', ({ currentTime, duration, percent }) => {
      if (barSlider && !document.activeElement?.isEqualNode(barSlider)) {
        barSlider.value = percent;
        applySliderProgress(barSlider, percent);
      }
      if (scrubSlider && !document.activeElement?.isEqualNode(scrubSlider)) {
        scrubSlider.value = percent;
        applySliderProgress(scrubSlider, percent);
      }

      const curStr = window.youtubeEngine.formatDuration(currentTime);
      const durStr = window.youtubeEngine.formatDuration(duration);

      if (barTimeCur) barTimeCur.textContent = curStr;
      if (barTimeDur) barTimeDur.textContent = durStr;
      if (fullTimeCur) fullTimeCur.textContent = curStr;
      if (fullTimeDur) fullTimeDur.textContent = durStr;

      const miniFill = document.getElementById('mini-progress-fill');
      if (miniFill) miniFill.style.width = `${percent}%`;

      this.updateLyricsHighlight(currentTime);
    });
  }

  updatePlayStateUI(isPlaying) {
    const playSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    const pauseSvg = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';

    const barBtn = document.getElementById('main-play-btn-bar');
    const miniBtn = document.getElementById('mini-play-btn');
    const fullBtn = document.getElementById('full-play-btn');

    if (barBtn) barBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
    if (miniBtn) miniBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
    if (fullBtn) fullBtn.innerHTML = isPlaying ? pauseSvg : playSvg;
  }

  openFullPlayer() {
    const modal = document.getElementById('full-player-modal');
    if (modal) modal.classList.add('open');
  }

  closeFullPlayer() {
    const modal = document.getElementById('full-player-modal');
    if (modal) modal.classList.remove('open');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }
}

window.ui = new UIController();
