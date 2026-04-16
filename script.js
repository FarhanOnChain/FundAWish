// ── FundAWish ──
// Paste your deployed Google Apps Script Web App URL here:
const API_URL = 'https://script.google.com/macros/s/AKfycbxhWvdsBSF73qCbSCPtaOq95LVb3irtGAv5mSAFCu7FpkUFUnkWVgXnljcTxmaWvqrp4w/exec';

const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

// ── Helpers ──
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = orig, 1800);
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = orig, 1800);
  });
}

// ── API ──
async function apiGet() {
  const res = await fetch(API_URL, { method: 'GET' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to load');
  return data.wishes;
}

async function apiPost(body) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Scroll reveal ──
function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible)');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 80);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => obs.observe(el));
}

// ── Field error helpers ──
function setFieldError(inputId, msg) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let err = document.getElementById(inputId + '-err');
  if (!err) {
    err = document.createElement('span');
    err.id = inputId + '-err';
    err.style.cssText = 'color:#c0624a;font-size:0.82rem;margin-top:0.3rem;display:block;line-height:1.4;';
    input.parentNode.appendChild(err);
  }
  err.textContent = msg;
  input.style.borderColor = msg ? '#c0624a' : '';
  input.style.boxShadow   = msg ? '0 0 0 3px rgba(192,98,74,0.12)' : '';
}

function clearFieldError(inputId) {
  setFieldError(inputId, '');
}

// ── Page: MAKE ──
function initMakePage() {
  const form = document.getElementById('wish-form');
  const successEl = document.getElementById('success-area');
  if (!form) return;

  // Clear errors on input
  ['f-name','f-text','f-amount','f-x','f-wallet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearFieldError(id));
  });

  // Live wallet validation on blur
  const walletInput = document.getElementById('f-wallet');
  if (walletInput) {
    walletInput.addEventListener('blur', () => {
      const val = walletInput.value.trim();
      if (val && !EVM_REGEX.test(val)) {
        setFieldError('f-wallet', 'Must start with 0x and be exactly 42 characters (hex only)');
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let hasError = false;

    const name     = document.getElementById('f-name').value.trim() || 'Anon';
    const text     = document.getElementById('f-text').value.trim();
    const amount   = document.getElementById('f-amount').value.trim();
    const x_handle = document.getElementById('f-x').value.trim();
    const wallet   = document.getElementById('f-wallet').value.trim();

    if (!text)     { setFieldError('f-text',   'Please describe your wish');                          hasError = true; }
    if (!amount)   { setFieldError('f-amount',  'Please enter the amount you need');                   hasError = true; }
    if (!x_handle) { setFieldError('f-x',       'X handle is required so supporters can reach you');  hasError = true; }
    if (!wallet)   {
      setFieldError('f-wallet', 'EVM wallet address is required');
      hasError = true;
    } else if (!EVM_REGEX.test(wallet)) {
      setFieldError('f-wallet', 'Must start with 0x and be exactly 42 characters (hex only)');
      hasError = true;
    }

    if (hasError) return;

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sharing...';

    try {
      const result = await apiPost({ action: 'createWish', name, text, amount, wallet, x_handle });
      const confirmUrl = location.href.replace('make.html', 'confirm.html').split('?')[0] + '?token=' + result.claim_token;

      form.style.display = 'none';
      successEl.style.display = 'block';
      document.getElementById('confirm-link').textContent = confirmUrl;

      document.getElementById('copy-btn').onclick = () => {
        copyText(confirmUrl, document.getElementById('copy-btn'));
      };
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Share my wish';
      const topErr = document.getElementById('form-top-error');
      if (topErr) { topErr.textContent = 'Something went wrong. Please try again.'; topErr.style.display = 'block'; }
    }
  });
}

// ── Page: FULFILL ──
function initFulfillPage() {
  const grid      = document.getElementById('wishes-grid');
  const lbSection = document.getElementById('leaderboard-section');
  const lbGrid    = document.getElementById('lb-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="empty-state"><p style="opacity:0.5;">Loading wishes...</p></div>`;

  async function loadAndRender() {
    try {
      const wishes = await apiGet();
      renderWishes(wishes);
    } catch {
      grid.innerHTML = `<div class="empty-state"><p>Could not load wishes right now. Try again soon.</p></div>`;
    }
  }

  function renderWishes(wishes) {
    const openWishes = wishes.filter(w => w.status === 'open');
    grid.innerHTML = '';

    if (!openWishes.length) {
      grid.innerHTML = `<div class="empty-state"><p>No open wishes right now. Be the first to share one.</p></div>`;
    } else {
      openWishes.forEach(w => grid.appendChild(buildWishCard(w)));
    }

    // Leaderboard
    const completed = wishes.filter(w => w.status === 'completed');
    if (completed.length && lbSection && lbGrid) {
      lbSection.style.display = 'block';
      const grouped = {};
      completed.forEach(w => {
        const k = w.name || 'Anon';
        if (!grouped[k]) grouped[k] = 0;
        const num = parseFloat(String(w.amount).replace(/[^0-9.]/g, '')) || 0;
        grouped[k] += num;
      });
      const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
      lbGrid.innerHTML = '';
      sorted.slice(0, 10).forEach(([person, total], i) => {
        const rank = i + 1;
        const isTop = rank <= 3;
        const item = document.createElement('div');
        item.className = `lb-card reveal${isTop ? ' lb-top-highlight' : ''}`;
        item.innerHTML = `
          <div class="lb-rank${isTop ? ' top' : ''}">${rank}</div>
          <div class="lb-info">
            <div class="lb-name">${escHtml(person)}</div>
            <div class="lb-amount">wish fulfilled</div>
          </div>
          <div class="amount-badge">${total > 0 ? total.toFixed(0) : 'supported'}</div>
        `;
        lbGrid.appendChild(item);
      });
    } else if (lbSection) {
      lbSection.style.display = 'none';
    }

    initReveal();
  }

  function buildWishCard(w) {
    const div = document.createElement('div');
    div.className = 'wish-card reveal';

    const xLine = w.x_handle
      ? `<a class="wish-x" href="https://x.com/${escHtml(w.x_handle)}" target="_blank" rel="noopener">@${escHtml(w.x_handle)}</a>`
      : '';

    div.innerHTML = `
      <div class="wish-card-top">
        <div class="wish-text">${escHtml(w.text)}</div>
        <div class="amount-badge">${escHtml(w.amount)}</div>
      </div>
      <div class="wish-meta">
        <span class="wish-name">${escHtml(w.name || 'Anon')}</span>
        ${xLine}
        <span class="badge badge-open">Open</span>
      </div>
      <div class="wish-action">
        <button class="btn btn-primary btn-full support-btn">
          Support this wish
        </button>
      </div>
    `;

    div.querySelector('.support-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Processing...';

      try {
        await apiPost({ action: 'updateStatus', claim_token: w.claim_token, id: w.id, status: 'pending' });

        const actionEl = div.querySelector('.wish-action');
        actionEl.innerHTML = `
          <div class="wallet-reveal">
            <p class="wallet-label">Send to this wallet</p>
            <div class="wallet-box">
              <code class="wallet-addr">${escHtml(w.wallet)}</code>
              <button class="btn btn-secondary copy-wallet-btn" style="padding:6px 14px;font-size:0.82rem;flex-shrink:0;">Copy</button>
            </div>
            <p class="wish-waiting" style="margin-top:0.8rem;">Waiting for ${escHtml(w.name || 'Anon')} to confirm receipt</p>
          </div>
        `;
        actionEl.querySelector('.copy-wallet-btn').addEventListener('click', (ce) => {
          copyText(w.wallet, ce.currentTarget);
        });

        const badge = div.querySelector('.badge');
        badge.className = 'badge badge-pending';
        badge.textContent = 'Pending';
      } catch {
        btn.disabled = false;
        btn.textContent = 'Support this wish';
      }
    });

    return div;
  }

  // Dev card: expandable
  const devCard = document.getElementById('dev-card');
  if (devCard) {
    const devExpanded  = document.getElementById('dev-expanded');
    const devToggleBtn = devCard.querySelector('.dev-btn');

    devToggleBtn.addEventListener('click', () => {
      if (!devExpanded) return;
      const open = devExpanded.style.display !== 'none' && devExpanded.style.display !== '';
      devExpanded.style.display = open ? 'none' : 'block';
      devToggleBtn.textContent  = open ? 'Show some love' : 'Close';
    });

    const copyWalletBtn = document.getElementById('copy-dev-wallet');
    if (copyWalletBtn) {
      copyWalletBtn.addEventListener('click', () => {
        copyText('0x00547C5811c09102cB632Bbb945C395F8567d573', copyWalletBtn);
      });
    }

    const contactBtn = document.getElementById('dev-contact-btn');
    if (contactBtn) {
      contactBtn.addEventListener('click', () => window.open('https://linktr.ee/FarhanOnChain', '_blank'));
    }
  }

  loadAndRender();
}

// ── Page: CONFIRM ──
async function initConfirmPage() {
  const token    = new URLSearchParams(location.search).get('token');
  const card     = document.getElementById('confirm-card-content');
  const notFound = document.getElementById('not-found');
  const loading  = document.getElementById('confirm-loading');

  if (!token) {
    if (loading)  loading.style.display  = 'none';
    if (notFound) notFound.style.display = 'block';
    return;
  }

  try {
    const wishes = await apiGet();
    const wish   = wishes.find(w => w.claim_token === token);

    if (loading) loading.style.display = 'none';
    if (!wish)   { if (notFound) notFound.style.display = 'block'; return; }

    card.style.display = 'block';
    document.getElementById('c-text').textContent   = wish.text;
    document.getElementById('c-name').textContent   = wish.name || 'Anon';
    document.getElementById('c-amount').textContent = wish.amount;

    const btnYes = document.getElementById('confirm-yes');
    const btnNo  = document.getElementById('confirm-no');
    const result = document.getElementById('confirm-result');

    if (wish.status === 'completed') {
      btnYes.disabled = btnNo.disabled = true;
      result.textContent = 'This wish has already been confirmed as fulfilled.';
      result.style.cssText = 'display:block;color:#357a55;';
      return;
    }

    if (wish.status === 'open') {
      btnYes.disabled = true;
      result.textContent = 'No one has marked support for this wish yet.';
      result.style.cssText = 'display:block;color:var(--ink-faint);';
    }

    btnYes.addEventListener('click', async () => {
      btnYes.disabled = btnNo.disabled = true;
      btnYes.textContent = 'Confirming...';
      try {
        await apiPost({ action: 'updateStatus', claim_token: token, status: 'completed' });
        result.textContent = 'Thank you. Your wish is now marked as fulfilled.';
        result.style.cssText = 'display:block;color:#357a55;';
        btnYes.textContent = 'Confirmed';
      } catch {
        btnYes.disabled = btnNo.disabled = false;
        btnYes.textContent = 'I received this support';
        result.textContent = 'Something went wrong. Please try again.';
        result.style.cssText = 'display:block;color:#c0624a;';
      }
    });

    btnNo.addEventListener('click', async () => {
      btnYes.disabled = btnNo.disabled = true;
      btnNo.textContent = 'Noting...';
      try {
        await apiPost({ action: 'updateStatus', claim_token: token, status: 'open' });
        result.textContent = 'Noted. Your wish is back to open so others can try again.';
        result.style.cssText = 'display:block;color:var(--ink-faint);';
        btnNo.textContent = 'Done';
      } catch {
        btnYes.disabled = btnNo.disabled = false;
        btnNo.textContent = 'I did not receive anything';
        result.textContent = 'Something went wrong. Please try again.';
        result.style.cssText = 'display:block;color:#c0624a;';
      }
    });

  } catch {
    if (loading)  loading.style.display  = 'none';
    if (notFound) notFound.style.display = 'block';
  }
}

// ── Mobile: reduce heavy effects ──
function initMobileOptimize() {
  if (window.innerWidth > 768) return;
  // Remove extra orbs
  document.querySelectorAll('.orb-3,.orb-4,.orb-5').forEach(o => o.remove());
  // Reduce remaining orbs
  document.querySelectorAll('.orb-1,.orb-2').forEach(o => {
    o.style.filter = 'blur(55px)';
    o.style.opacity = '0.22';
    o.style.animationDuration = '70s';
  });
  // Reduce card shadows
  document.querySelectorAll('.wish-card,.card').forEach(c => {
    c.style.boxShadow = '0 4px 16px rgba(180,120,80,0.08)';
    c.style.backdropFilter = 'blur(10px)';
  });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initMobileOptimize();
  initReveal();
  initMakePage();
  initFulfillPage();
  initConfirmPage();
});
