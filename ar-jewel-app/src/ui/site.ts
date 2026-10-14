/**
 * ANVAYA public site (site.html) — menu, the try-on preview and the enquiry form.
 * The booth itself lives in main.ts; this file only drives the marketing page.
 */

interface Piece {
  readonly symbol: string;
  readonly name: string;
  readonly description: string;
  readonly craft: string;
  readonly metal: string;
  readonly stones: string;
  readonly fit: string;
}

const PIECES: Record<string, Piece> = {
  necklace: {
    symbol: '#jwl-necklace',
    name: 'Rani Haar',
    description: 'Seven-strand bridal haar with an uncut polki centrepiece and carved emerald drops.',
    craft: 'Kundan Polki',
    metal: '22k yellow gold',
    stones: 'Uncut diamond, emerald',
    fit: 'Neck tracking',
  },
  earrings: {
    symbol: '#jwl-earrings',
    name: 'Chandbali Jhumka',
    description: 'Dome-and-bell jhumka with a pearl fringe modelled to swing with head movement.',
    craft: 'Temple gold',
    metal: '22k yellow gold',
    stones: 'Basra pearl, ruby',
    fit: 'Ear tracking',
  },
  ring: {
    symbol: '#jwl-ring',
    name: 'Navratna Ring',
    description: 'Nine auspicious stones around a central table-cut diamond in a raised jadau collet.',
    craft: 'Jadau',
    metal: '22k yellow gold',
    stones: 'Navratna, table-cut diamond',
    fit: 'Hand tracking',
  },
  bangle: {
    symbol: '#jwl-bangle',
    name: 'Meenakari Kada',
    description: 'Broad kada with enamel work on the reverse — rendered so both faces are worth turning.',
    craft: 'Meenakari',
    metal: '22k yellow gold',
    stones: 'Enamel, uncut diamond',
    fit: 'Wrist tracking',
  },
  set: {
    symbol: '#jwl-set',
    name: 'Bridal Set',
    description: 'Haar with matching jhumkas, presented together the way it is worn on the day.',
    craft: 'Kundan Polki',
    metal: '22k yellow gold',
    stones: 'Uncut diamond, emerald, pearl',
    fit: 'Neck + ear tracking',
  },
};

const byId = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

function setText(id: string, value: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ---------- mobile menu ---------- */
function initMenu(): void {
  const btn = byId<HTMLButtonElement>('menuBtn');
  const panel = byId<HTMLElement>('mobileNav');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
    btn.textContent = opening ? 'Close' : 'Menu';
  });

  panel.addEventListener('click', (event: MouseEvent) => {
    if (!(event.target instanceof HTMLAnchorElement)) return;
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = 'Menu';
  });
}

/* ---------- try-on preview ---------- */
function initStage(): void {
  const use = document.getElementById('pieceUse');
  const svg = byId<HTMLElement>('pieceSvg');
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.rail-btn'));
  if (!use || buttons.length === 0) return;

  const select = (key: string): void => {
    const piece = PIECES[key];
    if (!piece) return;
    use.setAttribute('href', piece.symbol);
    setText('pName', piece.name);
    setText('pDesc', piece.description);
    setText('pCraft', piece.craft);
    setText('pMetal', piece.metal);
    setText('pStones', piece.stones);
    setText('pFit', piece.fit);
    if (svg) {
      // restart the entrance so the swap reads as a change
      svg.style.animation = 'none';
      void svg.getBoundingClientRect().width;
      svg.style.animation = '';
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
      const key = button.dataset.piece;
      if (key) select(key);
    });
  }

  const modes = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode button'));
  for (const button of modes) {
    button.addEventListener('click', () => {
      for (const other of modes) other.setAttribute('aria-pressed', 'false');
      button.setAttribute('aria-pressed', 'true');
      setText('modeLabel', button.dataset.mode === 'VR' ? 'VR Showroom' : 'AR Try-On');
    });
  }
}

/* ---------- enquiry form ----------
   TODO: POST to the booth API (server/server.mjs) once an enquiry endpoint
   exists. Today submit() only renders a confirmation in the page. */
function initForm(): void {
  const form = byId<HTMLFormElement>('contactForm');
  const note = byId<HTMLParagraphElement>('formNote');
  const nameField = byId<HTMLInputElement>('cName');
  const emailField = byId<HTMLInputElement>('cEmail');
  if (!form || !note || !nameField || !emailField) return;

  form.addEventListener('submit', (event: Event) => {
    event.preventDefault();
    const name = nameField.value.trim();
    const email = emailField.value.trim();
    if (!name || !email) {
      note.className = 'form-note';
      note.textContent = 'Add your name and email so we can reply.';
      return;
    }
    note.className = 'sent';
    note.textContent = `Thank you, ${name.split(' ')[0]}. We'll be in touch.`;
  });
}

/* ---------- active nav link ---------- */
function initScrollSpy(): void {
  if (!('IntersectionObserver' in window)) return;
  const links = new Map<string, HTMLAnchorElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>('.nav a')) {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#')) links.set(href.slice(1), link);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const link = links.get(entry.target.id);
        if (!link || !entry.isIntersecting) continue;
        for (const other of links.values()) other.removeAttribute('aria-current');
        link.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );

  for (const id of links.keys()) {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  }
}

initMenu();
initStage();
initForm();
initScrollSpy();

export {}; // isolatedModules: keep this file a module
