import type { CatalogItem, JewelType } from '../types';
import { adminList, adminSave, adminUpload, getConfig } from '../backend/api';
import { MATERIAL_NAMES } from '../render/materials';
import { preloadTracker, TryOn } from '../render/tryon';

// Admin sign-in is one shared token held only in this tab. TODO(confirm): real accounts + MFA (security-privacy.md).
const KEY = 'admin-token';
const KINDS: Record<JewelType, string[]> = { earrings: ['jhumka', 'stud', 'hoop', 'drop'], necklace: ['choker', 'pendant', 'haar'] };
const app = document.getElementById('app')!;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const token = () => sessionStorage.getItem(KEY) ?? '';

let items: CatalogItem[] = [];
let preview: TryOn | undefined;

const blank = (): CatalogItem => ({
  id: '',
  name: '',
  type: 'earrings',
  model: 'procedural:jhumka',
  material: 'yellow-gold',
  anchor: { offset: [0, 0, 0], scale: 1 },
  active: true,
});
const flash = (msg: string, ok = false) => {
  const m = document.getElementById('msg');
  if (m) m.innerHTML = `<div class="msg ${ok ? 'ok' : 'err'}">${esc(msg)}</div>`;
};

function login(err = '') {
  app.innerHTML = `<h1>Catalog admin</h1>${err ? `<div class="msg err">${esc(err)}</div>` : ''}
    <form id="f" style="max-width:360px"><label for="t">Admin token</label><input id="t" type="password" autocomplete="current-password" required>
    <p><button class="btn btn-primary">Sign in</button></p></form>`;
  document.getElementById('f')!.onsubmit = async (e) => {
    e.preventDefault();
    sessionStorage.setItem(KEY, (document.getElementById('t') as HTMLInputElement).value);
    try {
      items = await adminList(token());
      drawList();
    } catch {
      sessionStorage.removeItem(KEY);
      const c = await getConfig();
      login(c.adminEnabled ? 'Wrong token.' : 'Admin is disabled: set ADMIN_TOKEN on the server.');
    }
  };
}

function drawList() {
  closePreview();
  app.innerHTML = `<h1>Catalog</h1><div id="msg"></div>
    <p><button class="btn btn-primary" id="add">Add piece</button> <button class="btn" id="out">Sign out</button></p>
    <table><thead><tr><th></th><th>Name</th><th>Type</th><th>Active</th><th></th></tr></thead><tbody>
    ${items
      .map(
        (
          it,
          i,
        ) => `<tr><td>${it.thumbnail ? `<img src="${esc(it.thumbnail)}" alt="">` : '<div class="sw" style="background:var(--hairline)"></div>'}</td>
      <td>${esc(it.name)}<br><span class="muted">${esc(it.id)}</span></td><td>${esc(it.type)}</td>
      <td><input type="checkbox" data-act="${i}" ${it.active ? 'checked' : ''} aria-label="Active: ${esc(it.name)}"></td>
      <td><button class="btn" data-edit="${i}">Edit</button> <button class="btn btn-danger" data-del="${i}">Delete</button></td></tr>`,
      )
      .join('')}
    </tbody></table>`;
  document.getElementById('add')!.onclick = () => drawForm(blank(), -1);
  document.getElementById('out')!.onclick = () => {
    sessionStorage.removeItem(KEY);
    login();
  };
  app.querySelectorAll<HTMLInputElement>('[data-act]').forEach(
    (c) =>
      (c.onchange = async () => {
        items[+c.dataset.act!].active = c.checked;
        await persist('Saved.');
      }),
  );
  app
    .querySelectorAll<HTMLElement>('[data-edit]')
    .forEach((b) => (b.onclick = () => drawForm(structuredClone(items[+b.dataset.edit!]), +b.dataset.edit!)));
  app.querySelectorAll<HTMLElement>('[data-del]').forEach(
    (b) =>
      (b.onclick = async () => {
        const it = items[+b.dataset.del!];
        if (!confirm(`Delete "${it.name}"? This cannot be undone.`)) return;
        items.splice(+b.dataset.del!, 1);
        await persist('Deleted.');
        drawList();
      }),
  );
}

async function persist(okMsg: string) {
  try {
    await adminSave(token(), items);
    flash(okMsg, true);
  } catch (e) {
    flash((e as Error).message);
  }
}

function drawForm(it: CatalogItem, idx: number) {
  const procedural = it.model.startsWith('procedural:');
  const story = it.story ?? [];
  app.innerHTML = `<h1>${idx < 0 ? 'Add piece' : 'Edit piece'}</h1><div id="msg"></div>
  <div class="grid2"><form id="f">
    <label for="id">ID (e.g. ear-005)</label><input id="id" value="${esc(it.id)}" ${idx >= 0 ? 'readonly' : ''} required pattern="[a-z0-9-]+">
    <label for="name">Name</label><input id="name" value="${esc(it.name)}" required>
    <label for="type">Type</label><select id="type"><option value="earrings">Earrings</option><option value="necklace">Necklace</option></select>
    <label for="material">Material</label><select id="material">${MATERIAL_NAMES.map((m) => `<option>${m}</option>`).join('')}</select>
    <label for="kind">Model</label><select id="kind"></select>
    <label for="glb">Or upload a .glb model</label><input id="glb" type="file" accept=".glb">
    <label for="thumb">Thumbnail (square image)</label><input id="thumb" type="file" accept="image/*">
    <div class="grid2"><div><label for="ox">Offset X</label><input id="ox" type="number" step="0.01" value="${it.anchor.offset[0]}"></div>
      <div><label for="oy">Offset Y</label><input id="oy" type="number" step="0.01" value="${it.anchor.offset[1]}"></div>
      <div><label for="oz">Offset Z</label><input id="oz" type="number" step="0.01" value="${it.anchor.offset[2]}"></div>
      <div><label for="sc">Scale</label><input id="sc" type="number" step="0.05" min="0.1" value="${it.anchor.scale}"></div></div>
    <div class="grid2"><div><label for="sz">Real size in mm (earring drop height, necklace width)</label><input id="sz" type="number" step="0.5" min="1" value="${it.dimensions?.sizeMm ?? ''}" placeholder="default"></div>
      <div><label for="yo">Height offset in mm</label><input id="yo" type="number" step="0.5" value="${it.dimensions?.yOffsetMm ?? 0}"></div></div>
    <h2 style="margin-top:20px">Craft story (optional, up to 3)</h2>
    <p class="muted">Real facts only. Leave empty to hide the Details button.</p>
    ${[0, 1, 2]
      .map(
        (n) => `<div class="card"><label for="st${n}">Title</label><input id="st${n}" maxlength="30" value="${esc(story[n]?.title ?? '')}">
      <label for="sx${n}">Text</label><input id="sx${n}" maxlength="160" value="${esc(story[n]?.text ?? '')}">
      <label for="sp${n}">Macro photo</label><input id="sp${n}" type="file" accept="image/*"></div>`,
      )
      .join('')}
    <label><input type="checkbox" id="active" ${it.active ? 'checked' : ''}> Active (visible on the booth)</label>
    <p><button class="btn btn-primary">Save</button> <button type="button" class="btn" id="cancel">Cancel</button></p>
  </form>
  <div><h2>Live preview</h2><p class="muted">Uses your own webcam. Nothing is stored.</p>
    <button class="btn" id="pv">Start preview</button><div class="preview"><div class="stage" id="pvStage"></div></div></div></div>`;

  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const type = $<HTMLSelectElement>('type'),
    kind = $<HTMLSelectElement>('kind');
  type.value = it.type;
  $<HTMLSelectElement>('material').value = it.material;
  const fillKinds = () => {
    kind.innerHTML =
      KINDS[type.value as JewelType].map((k) => `<option value="procedural:${k}">${k} (placeholder)</option>`).join('') +
      (!procedural ? `<option value="${esc(it.model)}">current file</option>` : '');
    kind.value =
      KINDS[type.value as JewelType].some((k) => `procedural:${k}` === it.model) || !procedural
        ? it.model
        : `procedural:${KINDS[type.value as JewelType][0]}`;
  };
  fillKinds();
  type.onchange = () => {
    it.model = `procedural:${KINDS[type.value as JewelType][0]}`;
    fillKinds();
    sync();
  };

  const read = () => {
    it.name = $<HTMLInputElement>('name').value;
    it.id = $<HTMLInputElement>('id').value;
    it.type = type.value as JewelType;
    it.material = $<HTMLSelectElement>('material').value;
    it.model = kind.value;
    it.anchor = {
      offset: [+$<HTMLInputElement>('ox').value, +$<HTMLInputElement>('oy').value, +$<HTMLInputElement>('oz').value],
      scale: +$<HTMLInputElement>('sc').value || 1,
    };
    const size = +$<HTMLInputElement>('sz').value;
    it.dimensions = size > 0 ? { ...it.dimensions, sizeMm: size, yOffsetMm: +$<HTMLInputElement>('yo').value || 0 } : undefined;
    it.active = $<HTMLInputElement>('active').checked;
  };
  const sync = () => {
    read();
    void preview?.setPiece(it);
  };
  app.querySelectorAll('select,input[type=number]').forEach((e) => e.addEventListener('input', sync));

  $('cancel').onclick = drawList;
  $('pv').onclick = async () => {
    try {
      await preloadTracker();
      preview ??= new TryOn($('pvStage'), 1080, 1920);
      await preview.setPiece(it);
      await preview.start();
    } catch {
      flash('Camera is not available.');
    }
  };

  const up = async (id: string) => {
    const f = $<HTMLInputElement>(id).files?.[0];
    return f ? (await adminUpload(token(), f)).path : undefined;
  };
  $<HTMLFormElement>('f').onsubmit = async (e) => {
    e.preventDefault();
    read();
    try {
      const glb = await up('glb');
      if (glb) it.model = glb;
      const th = await up('thumb');
      if (th) it.thumbnail = th;
      const callouts = [];
      for (let n = 0; n < 3; n++) {
        const title = $<HTMLInputElement>(`st${n}`).value.trim(),
          text = $<HTMLInputElement>(`sx${n}`).value.trim();
        if (!title && !text) continue;
        if (!title || !text) throw new Error('Each craft story needs both a title and text.');
        callouts.push({ title, text, photo: (await up(`sp${n}`)) ?? story[n]?.photo });
      }
      it.story = callouts.length ? callouts : undefined;
      if (!it.id || !it.name) throw new Error('ID and name are required.');
      if (idx < 0 && items.some((x) => x.id === it.id)) throw new Error('That ID already exists.');
      if (idx < 0) items.push(it);
      else items[idx] = it;
      await adminSave(token(), items);
      drawList();
      flash('Saved.', true);
    } catch (err) {
      flash((err as Error).message);
    }
  };
}

function closePreview() {
  preview?.dispose();
  preview = undefined;
}

if (token())
  adminList(token())
    .then((l) => {
      items = l;
      drawList();
    })
    .catch(() => login());
else login();
