/**
 * AuraWave Main Application Controller
 * Handles lifecycle initialization, Service Worker registration, and PWA setup.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize UI & Components
  window.ui.init();

  // Register Service Worker for 100% Offline PWA functionality
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('AuraWave Service Worker registered successfully:', reg.scope);
    } catch (err) {
      console.warn('Service Worker registration failed:', err);
    }
  }

  // Handle PWA Install Prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) installBanner.style.display = 'flex';
  });

  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          window.ui.showToast('AuraWave installed to your home screen!', 'success');
        }
        deferredPrompt = null;
        const installBanner = document.getElementById('pwa-install-banner');
        if (installBanner) installBanner.style.display = 'none';
      }
    });
  }

  // Keyboard Shortcuts for Desktop / iPad with Keyboard
  document.addEventListener('keydown', (e) => {
    // Ignore when typing in input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      window.audioPlayer.togglePlay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      window.audioPlayer.nextTrack();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      window.audioPlayer.prevTrack();
    }
  });
});
