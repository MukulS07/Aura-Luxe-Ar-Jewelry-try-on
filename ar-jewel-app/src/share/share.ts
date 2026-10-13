const q = new URLSearchParams(location.search);
const id = q.get('p') ?? '',
  token = q.get('t') ?? '';
const app = document.getElementById('app')!;
const src = `/api/photos/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;

const gone = () => {
  app.innerHTML = '<h1>This photo is no longer available.</h1>';
};
const footer = '<footer><a href="/terms.html">Terms</a><a href="/terms.html#privacy">Privacy</a></footer>';

async function init() {
  const m = await fetch(`/api/photos/${encodeURIComponent(id)}/meta?t=${encodeURIComponent(token)}`);
  if (!m.ok) return gone();
  const { expires } = (await m.json()) as { expires: number };
  const when = new Date(expires).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  app.innerHTML = `<h1>Your photo</h1>
    <img class="photo" alt="Your photo with the jewelry" src="${src}">
    <p class="muted">Available until ${when}. Results are approximate. Real pieces may differ.</p>
    <div class="stack">
      <a class="btn btn-primary" id="dl" download="my-jewelry-photo.jpg" href="${src}">Download</a>
      <button class="btn" id="share" hidden>Share</button>
      <button class="btn btn-danger" id="del">Delete my photo</button>
    </div>${footer}`;
  const share = document.getElementById('share') as HTMLButtonElement;
  if (navigator.share) {
    share.hidden = false;
    share.onclick = async () => {
      try {
        const blob = await (await fetch(src)).blob();
        const file = new File([blob], 'my-jewelry-photo.jpg', { type: 'image/jpeg' });
        if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file] });
        else await navigator.share({ title: 'My jewelry try-on', url: location.href });
      } catch {
        /* cancelled */
      }
    };
  }
  document.getElementById('del')!.onclick = async () => {
    if (!confirm('Delete this photo now? This cannot be undone.')) return;
    await fetch(`/api/photos/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`, { method: 'DELETE' });
    gone();
  };
}

if (!/^[a-f0-9]{16}$/.test(id) || !token) gone();
else init().catch(gone);
