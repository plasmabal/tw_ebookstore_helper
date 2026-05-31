(function () {
  function overrideTimers() {
    if (!window.MooReaderApp) { setTimeout(overrideTimers, 200); return; }
    MooReaderApp.resetPreviewTimer = function () {
      if (this.previewTimer) clearTimeout(this.previewTimer);
    };
    MooReaderApp.resetRestAlertTimer = function () {
      if (this.restAlertTimer) clearTimeout(this.restAlertTimer);
    };
    if (MooReaderApp.previewTimer) clearTimeout(MooReaderApp.previewTimer);
    if (MooReaderApp.restAlertTimer) clearTimeout(MooReaderApp.restAlertTimer);
  }

  window.addEventListener('__teh_enable', overrideTimers);
})();
