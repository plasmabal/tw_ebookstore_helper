(function () {
  let enabled = false;
  let original = null;

  function tryOverride() {
    if (!enabled) return;
    if (!window.MooReaderApp) { setTimeout(tryOverride, 200); return; }
    if (!original) {
      original = {
        resetPreviewTimer:   MooReaderApp.resetPreviewTimer,
        resetRestAlertTimer: MooReaderApp.resetRestAlertTimer
      };
    }
    MooReaderApp.resetPreviewTimer = function () {
      if (this.previewTimer) clearTimeout(this.previewTimer);
    };
    MooReaderApp.resetRestAlertTimer = function () {
      if (this.restAlertTimer) clearTimeout(this.restAlertTimer);
    };
    if (MooReaderApp.previewTimer) clearTimeout(MooReaderApp.previewTimer);
    if (MooReaderApp.restAlertTimer) clearTimeout(MooReaderApp.restAlertTimer);
  }

  function restoreTimers() {
    enabled = false;
    if (!window.MooReaderApp || !original) return;
    MooReaderApp.resetPreviewTimer   = original.resetPreviewTimer;
    MooReaderApp.resetRestAlertTimer = original.resetRestAlertTimer;
    // 重新啟動計時器，恢復站方原有行為
    if (typeof MooReaderApp.resetPreviewTimer === 'function') MooReaderApp.resetPreviewTimer();
    if (typeof MooReaderApp.resetRestAlertTimer === 'function') MooReaderApp.resetRestAlertTimer();
  }

  window.addEventListener('__teh_enable', () => { enabled = true; tryOverride(); });
  window.addEventListener('__teh_disable', restoreTimers);
})();
