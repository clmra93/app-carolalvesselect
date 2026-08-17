// PWA Registration & Installation Handler
(function () {
  let deferredPrompt = null;

  // Auto-inject PWA Head tags if missing in subpages
  try {
    if (!document.querySelector('link[rel="manifest"]')) {
      const linkManifest = document.createElement('link');
      linkManifest.rel = 'manifest';
      linkManifest.href = '/manifest.json';
      document.head.appendChild(linkManifest);
    }

    if (!document.querySelector('meta[name="theme-color"]')) {
      const metaTheme = document.createElement('meta');
      metaTheme.name = 'theme-color';
      metaTheme.content = '#5c1838';
      document.head.appendChild(metaTheme);
    }

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const linkApple = document.createElement('link');
      linkApple.rel = 'apple-touch-icon';
      linkApple.href = '/assets/icons/apple-touch-icon.png';
      document.head.appendChild(linkApple);
    }

    if (!document.querySelector('link[rel="icon"]')) {
      const linkIcon = document.createElement('link');
      linkIcon.rel = 'icon';
      linkIcon.type = 'image/svg+xml';
      linkIcon.href = '/assets/icons/icon.svg';
      document.head.appendChild(linkIcon);
    }
  } catch (e) {
    console.warn('[PWA] Header auto-injection error:', e);
  }

  // 1. Register Service Worker with automatic update check
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
          // Check for service worker updates immediately
          reg.update();

          // Listen for new service worker controlling the page
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('[PWA] Novo Service Worker ativo. Atualizando cache...');
          });
        })
        .catch((err) => {
          console.error('[PWA] Erro ao registrar Service Worker:', err);
        });
    });

    // Check for updates when user returns to the tab or app
    window.addEventListener('focus', () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg) reg.update();
      });
    });
  }

  // 2. Listen for BeforeInstallPrompt Event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default mini-infobar
    e.preventDefault();
    deferredPrompt = e;

    // Show custom installation banner if not dismissed previously
    if (!localStorage.getItem('pwa_banner_dismissed')) {
      showInstallBanner();
    }

    // Enable any custom install buttons in the UI
    const installBtns = document.querySelectorAll('.btn-pwa-install');
    installBtns.forEach((btn) => {
      btn.style.display = 'inline-flex';
      btn.addEventListener('click', triggerPwaInstall);
    });
  });

  // 3. Listen for App Installed Event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] Aplicativo instalado com sucesso!');
    hideInstallBanner();
    deferredPrompt = null;
  });

  // 4. Function to trigger install
  function triggerPwaInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] Usuário aceitou a instalação');
      } else {
        console.log('[PWA] Usuário recusou a instalação');
      }
      deferredPrompt = null;
      hideInstallBanner();
    });
  }

  // 5. Build and display PWA Install Banner
  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 32px);
      max-width: 480px;
      background: linear-gradient(135deg, #ffffff, #fff5f8);
      border: 1px solid #f2c2d4;
      border-radius: 16px;
      padding: 14px 18px;
      box-shadow: 0 10px 30px rgba(92, 24, 56, 0.25);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      animation: pwaSlideUp 0.4s ease-out;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0;">
        <img src="/assets/icons/icon-192.png" alt="Carol Alves" style="width: 44px; height: 44px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); flex-shrink: 0;" />
        <div style="min-width: 0;">
          <div style="font-weight: 700; font-size: 0.95rem; color: #5c1838; margin-bottom: 2px;">Instalar App Carol Alves</div>
          <div style="font-size: 0.8rem; color: #666; line-height: 1.2;">Acesso rápido aos catálogos na sua tela inicial!</div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button id="pwa-install-btn" style="
          background: #5c1838;
          color: #ffffff;
          border: none;
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 600;
          font-size: 0.85rem;
          cursor: pointer;
          box-shadow: 0 3px 10px rgba(92, 24, 56, 0.3);
          transition: all 0.2s ease;
        ">Instalar</button>
        <button id="pwa-dismiss-btn" style="
          background: transparent;
          border: none;
          color: #999;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 4px;
          line-height: 1;
        " title="Fechar">&times;</button>
      </div>
    `;

    // Inject CSS keyframes for animation
    if (!document.getElementById('pwa-banner-styles')) {
      const style = document.createElement('style');
      style.id = 'pwa-banner-styles';
      style.textContent = `
        @keyframes pwaSlideUp {
          from { transform: translate(-50%, 100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        #pwa-install-btn:hover {
          background: #461029 !important;
          transform: scale(1.03);
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', () => {
      triggerPwaInstall();
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      hideInstallBanner();
      localStorage.setItem('pwa_banner_dismissed', 'true');
    });
  }

  function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) {
      banner.remove();
    }
  }
})();
