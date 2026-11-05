/* One inactivity clock shared by the brotherhood and chapter operations tabs. */
(function () {
  'use strict';
  const WARNING_AFTER = 10 * 60 * 1000, SIGN_OUT_AFTER = 13 * 60 * 1000;
  let uid = '', lastActivity = 0, lastWrite = 0, timer, dialog, previousFocus;
  let signingOut = false, expired = false, retryAt = 0;
  const key = () => '985.activity.' + uid;
  function readActivity() {
    try {
      const value = Number(localStorage.getItem(key()));
      if (value > lastActivity && value <= Date.now()) lastActivity = value;
    } catch (_) { /* The current tab still works when storage is unavailable. */ }
  }
  function closeWarning() {
    if (!dialog) return;
    dialog.close(); dialog.remove(); dialog = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
  function showWarning() {
    if (dialog || document.hidden) return;
    previousFocus = document.activeElement;
    dialog = document.createElement('dialog');
    dialog.className = 'nap-idle-dialog';
    dialog.setAttribute('aria-labelledby', 'nap-idle-title');
    dialog.setAttribute('aria-describedby', 'nap-idle-description');
    dialog.innerHTML = '<span class="nap-idle-icon" aria-hidden="true">◷</span><h2 id="nap-idle-title">Still here?</h2><p id="nap-idle-description">You’ve been inactive for a while. Stay signed in to keep using the portal.</p><p class="nap-idle-countdown"></p><div class="nap-idle-actions"><button type="button" data-idle="logout">Sign out</button><button type="button" data-idle="stay">Stay signed in</button></div><p class="nap-idle-error" role="alert" hidden></p>';
    dialog.addEventListener('cancel', e => { e.preventDefault(); activity(); });
    dialog.querySelector('[data-idle="stay"]').onclick = activity;
    dialog.querySelector('[data-idle="logout"]').onclick = () => { expired = true; signOut(); };
    document.body.append(dialog); dialog.showModal();
    dialog.querySelector('[data-idle="stay"]').focus({ preventScroll: true });
  }
  async function signOut() {
    if (signingOut || Date.now() < retryAt) return;
    signingOut = true;
    if (dialog) dialog.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      await auth.signOut();
      // Firebase's auth listener handles each portal's existing login screen.
      closeWarning();
    } catch (_) {
      retryAt = Date.now() + 5000;
      if (dialog) {
        const error = dialog.querySelector('.nap-idle-error');
        error.hidden = false; error.textContent = 'Could not sign out yet. Retrying…';
      }
    } finally { signingOut = false; }
  }
  function check() {
    if (!uid) return;
    readActivity();
    const idle = Date.now() - lastActivity;
    if (expired || idle >= SIGN_OUT_AFTER) { expired = true; signOut(); return; }
    if (idle < WARNING_AFTER) { closeWarning(); return; }
    showWarning();
    if (dialog) {
      const seconds = Math.max(0, Math.ceil((SIGN_OUT_AFTER - idle) / 1000));
      dialog.querySelector('.nap-idle-countdown').textContent = 'Signing out in ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
    }
  }
  function activity(event) {
    if (!uid || document.hidden || signingOut || event?.isTrusted === false) return;
    // Keep the dialog usable while moving between its controls.
    if (dialog && (event?.type === "pointermove" || (event?.type === "keydown" && event.key === "Tab"))) return;
    // Do not dismiss the warning before its Sign out button receives the click.
    if (event?.target?.closest?.('[data-idle="logout"]')) return;
    readActivity();
    if (expired || Date.now() - lastActivity >= SIGN_OUT_AFTER) { check(); return; }
    const wasWarning = !!dialog;
    lastActivity = Date.now();
    if (wasWarning || lastActivity - lastWrite >= 1000) {
      try { localStorage.setItem(key(), String(lastActivity)); } catch (_) {}
      lastWrite = lastActivity;
    }
    closeWarning();
  }
  ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'input'].forEach(type => document.addEventListener(type, activity, { passive: true, capture: true }));
  // Focusing or revealing a tab checks elapsed time; it does not reset it.
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('storage', event => { if (uid && event.key === key()) check(); });
  auth.onAuthStateChanged(user => {
    if (user?.uid === uid) return;
    clearInterval(timer); closeWarning();
    if (uid && !user) { try { localStorage.removeItem(key()); } catch (_) {} }
    uid = user?.uid || ''; signingOut = false; expired = false; retryAt = 0;
    if (!uid) return;
    lastActivity = 0; readActivity();
    if (!lastActivity) {
      lastActivity = Date.now();
      try { localStorage.setItem(key(), String(lastActivity)); } catch (_) {}
    }
    lastWrite = lastActivity;
    timer = setInterval(check, 1000); check();
  });
})();
