// utils.js
(function(){
    window.Utils = {
      showError: function(msg){
        const errorEl = document.getElementById('error');
        const asciiPre = document.getElementById('ascii');
        console.error(msg);
        errorEl.style.display = 'block';
        errorEl.textContent = 'ERROR:\n\n' + msg;
        asciiPre.textContent = '';
      },
      setupGlobalErrorHandlers: function(){
        window.addEventListener('error', (ev) => {
          const m = (ev && ev.error && ev.error.stack) ? ev.error.stack : (ev.message || String(ev));
          this.showError(m);
        });
        window.addEventListener('unhandledrejection', ev => {
          this.showError('Unhandled Promise Rejection:\n' + (ev.reason && ev.reason.stack ? ev.reason.stack : String(ev.reason)));
        });
      }
    };
  })();
  