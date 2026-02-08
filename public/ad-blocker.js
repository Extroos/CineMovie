// Global popup and ad blocker
(function() {
  'use strict';
  
  // Block window.open popups silently
  window.open = function() {
    console.log('Blocked window.open attempt');
    return null;
  };

  // Block annoying ad-loops
  window.alert = () => {};
  window.confirm = () => true;
  window.prompt = () => null;

  // Prevent suspicious activity on click
  document.addEventListener('click', function(e) {
    const target = e.target;
    if (target && target.tagName === 'A' && target.getAttribute('target') === '_blank') {
       if (!target.closest('[data-allow-external]')) {
          e.preventDefault();
          console.log('Blocked suspicious new tab');
       }
    }
  }, true);

  // Periodic cleanup of common ad-related elements
  setInterval(() => {
    const ads = document.querySelectorAll('[id*="ad"], [class*="ad-"], [class*="-ad"], [id*="pop-up"]');
    ads.forEach(ad => {
       if (!ad.hasAttribute('data-app-element')) ad.remove();
    });
  }, 2000);

  console.log('Professional Ad Blocker Active');
})();
