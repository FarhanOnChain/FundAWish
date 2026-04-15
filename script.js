// ── FundAWish Script ──

const API_BASE = '';  // same origin; swap for real backend URL

// ── Utility ──
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getWishes() {
  try { return JSON.parse(localStorage.getItem('fundawish_wishes') || '[]'); }
  catch { return []; }
}

function saveWishes(wishes) {
  localStorage.setItem('fundawish_wishes', JSON.stringify(wishes));
}

// ── API shim (localStorage) ──
const API = {
  createWish({ name, text, amount, wallet }) {
    const wishes = getWishes();
    const claim_token = uid();
    const wish = {
      id: uid(),
      name,
      text,
      amount,
      wallet,
      status: 'open',
      claim_token,
      created: Date.now(),
    };
    wishes.unshift(wish);
    saveWishes(wishes);
    return { ...wish };
  },

  getWishes() {
    return getWishes();
  },

  getWishByToken(token) {
    return getWishes().find(w => w.claim_token === token) || null;
  },

  getWishById(id) {
    return getWishes().find(w => w.id === id) || null;
  },

  updateStatus(id, status) {
    const wishes = getWishes();
    const idx = wishes.findIndex(w => w.id === id);
    if (idx === -1) return null;
    wishes[idx].status = status;
    if (status === 'pending') {
      wishes[idx].supported_by = wishes[idx].supported_by || 'Anonymous';
    }
    saveWishes(wishes);
    return wishes[idx];
  },

  supportWish(id, supporterName) {
    const wishes = getWishes();
    const idx = wishes.findIndex(w => w.id === id);
    if (idx === -1) return null;
    if (wishes[idx].status !== 'open') return wishes[idx];
    wishes[idx].status = 'pending';
    wishes[idx].supported_by = supporterName || 'Anonymous';
    saveWishes(wishes);
    return wishes[idx];
  },
};

// ── Scroll reveal ──
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

// ── Copy to clipboard ──
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = orig, 1800);
  });
}

// ── Page: MAKE ──
function initMakePage() {
  const form = document.getElementById('wish-form');
  const successEl = document.getElementById('success-area');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name   = form.querySelector('#f-name').value.trim();
    const text   = form.querySelector('#f-text').value.trim();
    const amount = form.querySelector('#f-amount').value.trim();
    const wallet = form.querySelector('#f-wallet').value.trim();

    if (!name || !text || !amount) {
      showFormError('Please fill in all required fields.');
      return;
    }

    const wish = API.createWish({ name, text, amount, wallet });
    const confirmUrl = `${location.origin}${location.pathname.replace('make.html','confirm.html')}?token=${wish.claim_token}`;

    // Show success
    form.style.display = 'none';
    successEl.style.display = 'block';
    document.getElementById('confirm-link').textContent = confirmUrl;
    document.getElementById('confirm-link-full').textContent = confirmUrl;

    document.getElementById('copy-btn').onclick = () => {
      copyText(confirmUrl, document.getElementById('copy-btn'));
    };
  });
}

function showFormError(msg) {
  let err = document.getElementById('form-error');
  if (!err) {
    err = document.createElement('p');
    err.id = 'form-error';
    err.style.cssText = 'color:#c0754a;font-size:0.88rem;margin-top:-0.5rem;margin-bottom:0.8rem;';
    document.getElementById('wish-form').prepend(err);
  }
  err.textContent = msg;
}

// ── Page: FULFILL ──
function initFulfillPage() {
  const grid = document.getElementById('wishes-grid');
  const lbSection = document.getElementById('leaderboard-section');
  const lbGrid = document.getElementById('lb-grid');
  if (!grid) return;

  function renderWishes() {
    const wishes = API.getWishes();
    grid.innerHTML = '';

    if (!wishes.length) {
      grid.innerHTML = `<div class="empty-state"><p>No wishes yet. Be the first to share one.</p></div>`;
    } else {
      wishes.forEach(w => {
        const card = buildWishCard(w);
        grid.appendChild(card);
      });
    }

    // Leaderboard
    const completed = wishes.filter(w => w.status === 'completed');
    if (completed.length && lbSection && lbGrid) {
      lbSection.style.display = 'block';
      const grouped = {};
      completed.forEach(w => {
        const k = w.supported_by || 'Anonymous';
        if (!grouped[k]) grouped[k] = 0;
        const num = parseFloat(w.amount) || 0;
        grouped[k] += num;
      });
      const sorted = Object.entries(grouped).sort((a,b) => b[1]-a[1]);
      lbGrid.innerHTML = '';
      sorted.slice(0, 10).forEach(([name, total], i) => {
        const rank = i + 1;
        const isTop = rank <= 3;
        const item = document.createElement('div');
        item.className = `lb-card reveal${isTop ? ' lb-top-highlight' : ''}`;
        item.innerHTML = `
          <div class="lb-rank${isTop ? ' top' : ''}">${rank}</div>
          <div class="lb-info">
            <div class="lb-name">${escHtml(name)}</div>
            <div class="lb-amount">Total supported</div>
          </div>
          <div class="amount-badge">${total.toFixed(0)}</div>
        `;
        lbGrid.appendChild(item);
      });
      initReveal();
    } else if (lbSection) {
      lbSection.style.display = 'none';
    }

    initReveal();
  }

  function buildWishCard(w) {
    const div = document.createElement('div');
    div.className = 'wish-card reveal';
    div.dataset.id = w.id;

    const statusLabel = { open: 'Open', pending: 'Pending', completed: 'Completed' }[w.status] || w.status;
    const badgeClass  = { open: 'badge-open', pending: 'badge-pending', completed: 'badge-completed' }[w.status] || 'badge-open';

    let actionHtml = '';
    if (w.status === 'open') {
      actionHtml = `<button class="btn btn-primary btn-full support-btn" data-id="${w.id}">Support this wish</button>`;
    } else if (w.status === 'pending') {
      actionHtml = `<p class="wish-waiting">Waiting for confirmation from ${escHtml(w.name)}</p>`;
    } else {
      actionHtml = `<p class="wish-waiting" style="color:#357a55;">This wish was fulfilled</p>`;
    }

    div.innerHTML = `
      <div class="wish-card-top">
        <div class="wish-text">${escHtml(w.text)}</div>
        <div class="amount-badge">${escHtml(w.amount)}</div>
      </div>
      <div class="wish-meta">
        <span class="wish-name">${escHtml(w.name)}</span>
        <span class="badge ${badgeClass}">${statusLabel}</span>
      </div>
      <div class="wish-action">${actionHtml}</div>
    `;

    // Support button
    const supportBtn = div.querySelector('.support-btn');
    if (supportBtn) {
      supportBtn.addEventListener('click', () => {
        API.supportWish(w.id, 'A kind person');
        renderWishes();
      });
    }

    return div;
  }

  // Dev card
  const devCard = document.getElementById('dev-card');
  if (devCard) {
    devCard.querySelector('.dev-btn').addEventListener('click', () => {
      window.open('https://linktr.ee/FarhanOnChain', '_blank');
    });
  }

  renderWishes();
}

// ── Page: CONFIRM ──
function initConfirmPage() {
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const card = document.getElementById('confirm-card-content');
  const notFound = document.getElementById('not-found');

  if (!token) {
    if (notFound) notFound.style.display = 'block';
    return;
  }

  const wish = API.getWishByToken(token);
  if (!wish) {
    if (notFound) notFound.style.display = 'block';
    return;
  }

  if (card) {
    card.style.display = 'block';
    document.getElementById('c-text').textContent = wish.text;
    document.getElementById('c-name').textContent = wish.name;
    document.getElementById('c-amount').textContent = wish.amount;

    const btnYes = document.getElementById('confirm-yes');
    const btnNo  = document.getElementById('confirm-no');
    const result = document.getElementById('confirm-result');

    if (wish.status === 'completed') {
      btnYes.disabled = true;
      btnNo.disabled  = true;
      result.textContent = 'This wish has already been confirmed as fulfilled.';
      result.style.display = 'block';
    }

    if (btnYes) {
      btnYes.addEventListener('click', () => {
        API.updateStatus(wish.id, 'completed');
        btnYes.disabled = true;
        btnNo.disabled  = true;
        result.textContent = 'Thank you for confirming. Your wish is now marked as fulfilled.';
        result.style.display = 'block';
        result.style.color = '#357a55';
      });
    }
    if (btnNo) {
      btnNo.addEventListener('click', () => {
        API.updateStatus(wish.id, 'open');
        btnYes.disabled = true;
        btnNo.disabled  = true;
        result.textContent = 'Noted. Your wish has been moved back to open so others can try again.';
        result.style.display = 'block';
        result.style.color = '#a08c83';
      });
    }
  }
}

// ── Helpers ──
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initReveal();
  initMakePage();
  initFulfillPage();
  initConfirmPage();
});
