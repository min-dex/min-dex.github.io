// Confirm before any output is torn down. Cancelling must preserve the stream.
module.exports = function createOutputCloseGuard({ app, dialog, getWindow, isActive }) {
  let quitting = false;
  function confirm(event) {
    if (event.defaultPrevented) return false;
    if (!isActive()) return true;
    const options = {
      type: 'warning', title: 'Mindex 종료',
      message: '송출 중입니다. Mindex를 종료할까요?',
      detail: '종료하면 송출 화면과 방송 연결이 닫힙니다.',
      buttons: ['계속 사용', '종료'], defaultId: 0, cancelId: 0, noLink: true,
    };
    const window = getWindow();
    const choice = window && !window.isDestroyed()
      ? dialog.showMessageBoxSync(window, options) : dialog.showMessageBoxSync(options);
    if (choice === 1) return true;
    event.preventDefault();
    return false;
  }
  app.on('before-quit', event => { quitting = confirm(event); });
  return {
    bind(window) {
      window.on('close', event => { if (!quitting) confirm(event); });
      // An unsaved-input prompt can still cancel the accepted quit.
      window.webContents.on('will-prevent-unload', () => { quitting = false; });
    },
  };
};
