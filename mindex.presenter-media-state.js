// Output video lifecycle subscription; controller/remote transport remains external.
function bindPresenterOutputMediaState(isActive, notify) {
  let timer = null;
  const events = ['play', 'pause', 'ended', 'waiting', 'canplay', 'error', 'emptied', 'seeked'];
  const onState = event => {
    if (!isActive() || !event.target?.matches?.('#presenterOutputRoot video.presenter-video') || timer !== null) return;
    timer = window.setTimeout(() => { timer = null; notify(); }, 40);
  };
  events.forEach(type => document.addEventListener(type, onState, true));
  return () => {
    window.clearTimeout(timer);
    events.forEach(type => document.removeEventListener(type, onState, true));
  };
}
