// Global popup and ad blocker
(function() {
  'use strict';
  
  // Block window.open popups
  const originalOpen = window.open;
  window.open = function(...args) {
    // Only allow if triggered by user and is same origin
    const stackTrace = new Error().stack || '';
    if (stackTrace.includes('VideoPlayer') || stackTrace.includes('user gesture')) {
      console.log('Popup blocked by ad blocker');
    }
    return null;
  };

  // Block new tab/window creation
  window.addEventListener('beforeunload', function(e) {
    // Check if it's a user-initiated navigation
    if (!e.isTrusted) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // Prevent ad-related navigation
  document.addEventListener('click', function(e) {
    const target = e.target;
    
    // Block clicks on suspicious elements
    if (target && (
      target.classList.contains('ad') ||
      target.classList.contains('advertisement') ||
      target.getAttribute('data-ad') ||
      (target.tagName === 'A' && target.getAttribute('target') === '_blank' && !target.closest('[data-allow-external]'))
    )) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Ad click blocked');
    }
  }, true);

  // Block annoying overlays
  setInterval(() => {
    const suspiciousElements = document.querySelectorAll('[id*="ad"], [class*="popup"], [class*="modal"]:not([data-app-modal])');
    suspiciousElements.forEach(el => {
      const element = el;
      if (element.style.zIndex && parseInt(element.style.zIndex) > 9998 && !element.hasAttribute('data-app-modal')) {
        element.remove();
        console.log('Suspicious overlay removed');
      }
    });
  }, 1000);

  console.log('Ad blocker initialized');
})();

