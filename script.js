// ── FundAWish ──
const API_URL = 'https://script.google.com/macros/s/AKfycbxhWvdsBSF73qCbSCPtaOq95LVb3irtGAv5mSAFCu7FpkUFUnkWVgXnljcTxmaWvqrp4w/exec';

const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

// ── Helpers ──
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = orig, 1500);
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
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

// ── API ──
// All requests go through GET.
// Reads:  ?action=getWishes
// Writes: ?payload=<URI-encoded JSON body>

async function apiGet() {
  const res  = await fetch(API_URL + '?action=getWishes');
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to load wishes');
  return data.wishes || [];
}

async function apiPost(body) {
  const encoded = encodeURIComponent(JSON.stringify(body));
  const res     = await fetch(API_URL + '?payload=' + encoded);
  const data    = await res.json();
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Scroll reveal ──
function initReveal() {
  const els = document.querySelectorAll('.reveal:not(.visible)');
  if (!els.length) return;
  const obs = new IntersectionObserver(entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => obs.observe(el));
}

// ── Field errors ──
function setFieldError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  let err = document.getElementById(id + '-err');
  if (!err) {
    err = document.createElement('span');
    err.id = id + '-err';
    err.style.cssText = 'color:#c0624a;font-size:0.82rem;margin-top:4px;display:block;line-height:1.4;';
    el.parentNode.appendChild(err);
  }
  err.textContent    = msg;
  el.style.borderColor = msg ? '#c0624a' : '';
  el.style.boxShadow   = msg ? '0 0 0 3px rgba(192,98,74,0.12)' : '';
}

function clearFieldError(id) {
  setFieldError(id, '');
}

// ── MAKE PAGE ──
function initMakePage() {
  const form    = document.getElementById('wish-form');
  const success = document.getElementById('success-area');
  if (!form) return;

  ['f-name','f-text','f-amount','f-x','f-wallet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearFieldError(id));
  });

  // Wallet live validation on blur
  const walletEl = document.getElementById('f-wallet');
  if (walletEl) {
    walletEl.addEventListener('blur', () => {
      const v = walletEl.value.trim();
      if (v && !EVM_REGEX.test(v)) {
        setFieldError('f-wallet', 'Must start with 0x and be exactly 42 characters');
      }
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let hasError = false;

    const name   = document.getElementById('f-name').value.trim() || 'Anon';
    const text   = document.getElementById('f-text').value.trim();
    const amount = document.getElementById('f-amount').value.trim();
    const x      = document.getElementById('f-x').value.trim();
    const wallet = document.getElementById('f-wallet').value.trim();

    if (!text)   { setFieldError('f-text',   'Please describe your wish');                         hasError = true; }
    if (!amount) { setFieldError('f-amount',  'Please enter the amount you need');                  hasError = true; }
    if (!x)      { setFieldError('f-x',       'X handle is required so supporters can reach you'); hasError = true; }
    if (!wallet) {
      setFieldError('f-wallet', 'EVM wallet address is required');
      hasError = true;
    } else if (!EVM_REGEX.test(wallet)) {
      setFieldError('f-wallet', 'Must start with 0x and be exactly 42 characters');
      hasError = true;
    }

    if (hasError) return;

    const btn = form.querySelector('[type="submit"]');
    btn.disabled    = true;
    btn.textContent = 'Sharing...';

    try {
      const result = await apiPost({
        action:   'createWish',
        name,
        text,
        amount,
        wallet,
        x_handle: x,
      });

      // Build confirm URL relative to current page location
      // Works whether hosted on file://, localhost, or a real domain
      const base       = location.href.split('?')[0].replace(/make\.html$/, '');
      const confirmUrl = base + 'confirm.html?token=' + result.claim_token;

      form.style.display      = 'none';
      success.style.display   = 'block';

      document.getElementById('confirm-link').textContent = confirmUrl;
      document.getElementById('copy-btn').onclick = () =>
        copyText(confirmUrl, document.getElementById('copy-btn'));

    } catch (err) {
      btn.disabled    = false;
      btn.textContent = 'Share my wish';
      const topErr = document.getElementById('form-top-error');
      if (topErr) {
        topErr.textContent  = 'Could not submit. Please check your connection and try again.';
        topErr.style.display = 'block';
      }
    }
  });
}

// ── FULFILL PAGE ──
function initFulfillPage() {
  const grid      = document.getElementById('wishes-grid');
  const lbSection = document.getElementById('leaderboard-section');
  const lbGrid    = document.getElementById('lb-grid');
  if (!grid) return;

  grid.innerHTML = '<div class="empty-state"><p style="opacity:0.5;">Loading wishes...</p></div>';

  async function fetchAndRender() {
    try {
      const wishes = await apiGet();

      // Normalise status to lowercase string — sheet can return mixed case
      const normalised = wishes.map(w => ({
        ...w,
        id:          String(w.id          || ''),
        name:        String(w.name        || 'Anon'),
        text:        String(w.text        || ''),
        amount:      String(w.amount      || ''),
        wallet:      String(w.wallet      || ''),
        x_handle:    String(w.x_handle    || ''),
        claim_token: String(w.claim_token || ''),
        status:      String(w.status      || 'open').toLowerCase().trim(),
      }));

      render(normalised);
    } catch (err) {
      grid.innerHTML = '<div class="empty-state"><p>Could not load wishes. Try again soon.</p></div>';
    }
  }

  function render(wishes) {
    const open = wishes.filter(w => w.status === 'open');
    grid.innerHTML = '';

    if (!open.length) {
      grid.innerHTML = '<div class="empty-state"><p>No open wishes right now. Be the first to share one.</p></div>';
    } else {
      open.forEach(w => grid.appendChild(buildWishCard(w)));
    }

    // Leaderboard
    const completed = wishes.filter(w => w.status === 'completed');
    if (completed.length && lbSection && lbGrid) {
      lbSection.style.display = 'block';
      const grouped = {};
      completed.forEach(w => {
        const k = w.name || 'Anon';
        const n = parseFloat(String(w.amount).replace(/[^0-9.]/g,'')) || 0;
        grouped[k] = (grouped[k] || 0) + n;
      });
      lbGrid.innerHTML = '';
      Object.entries(grouped)
        .sort((a,b) => b[1]-a[1])
        .slice(0,10)
        .forEach(([name, total], i) => {
          const rank  = i + 1;
          const isTop = rank <= 3;
          const div   = document.createElement('div');
          div.className = 'lb-card reveal' + (isTop ? ' lb-top-highlight' : '');
          div.innerHTML = `
            <div class="lb-rank${isTop ? ' top' : ''}">${rank}</div>
            <div class="lb-info">
              <div class="lb-name">${escHtml(name)}</div>
              <div class="lb-amount">wish fulfilled</div>
            </div>
            <div class="amount-badge">${total > 0 ? total.toFixed(0) : 'supported'}</div>
          `;
          lbGrid.appendChild(div);
        });
    } else if (lbSection) {
      lbSection.style.display = 'none';
    }

    initReveal();
  }

  function buildWishCard(w) {
    const div     = document.createElement('div');
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
        <span class="wish-name">${escHtml(w.name)}</span>
        ${xLine}
        <span class="badge badge-open">Open</span>
      </div>
      <div class="wish-action">
        <button class="btn btn-primary btn-full support-btn">Support this wish</button>
      </div>
    `;

    div.querySelector('.support-btn').addEventListener('click', async (e) => {
      const btn       = e.currentTarget;
      btn.disabled    = true;
      btn.textContent = 'Processing...';

      try {
        await apiPost({
          action:      'updateStatus',
          claim_token: w.claim_token,
          status:      'pending',
        });

        const actionEl     = div.querySelector('.wish-action');
        actionEl.innerHTML = `
          <div class="wallet-reveal">
            <p class="wallet-label">Send to this wallet</p>
            <div class="wallet-box">
              <code class="wallet-addr">${escHtml(w.wallet)}</code>
              <button class="btn btn-secondary copy-wallet-btn" style="padding:6px 14px;font-size:0.82rem;flex-shrink:0;">Copy</button>
            </div>
            <p class="wish-waiting" style="margin-top:0.8rem;">Waiting for ${escHtml(w.name)} to confirm receipt</p>
          </div>
        `;
        actionEl.querySelector('.copy-wallet-btn')
          .addEventListener('click', ce => copyText(w.wallet, ce.currentTarget));

        const badge       = div.querySelector('.badge');
        badge.className   = 'badge badge-pending';
        badge.textContent = 'Pending';

      } catch {
        btn.disabled    = false;
        btn.textContent = 'Support this wish';
      }
    });

    return div;
  }

  // Dev card expand/collapse
  const devCard = document.getElementById('dev-card');
  if (devCard) {
    const devExpanded  = document.getElementById('dev-expanded');
    const devToggleBtn = devCard.querySelector('.dev-btn');

    if (devToggleBtn) {
      devToggleBtn.addEventListener('click', () => {
        if (!devExpanded) return;
        const open            = devExpanded.style.display === 'block';
        devExpanded.style.display = open ? 'none' : 'block';
        devToggleBtn.textContent  = open ? 'Show some love' : 'Close';
      });
    }

    const copyWalletBtn = document.getElementById('copy-dev-wallet');
    if (copyWalletBtn) {
      copyWalletBtn.addEventListener('click', () =>
        copyText('0x00547C5811c09102cB632Bbb945C395F8567d573', copyWalletBtn)
      );
    }

    const contactBtn = document.getElementById('dev-contact-btn');
    if (contactBtn) {
      contactBtn.addEventListener('click', () =>
        window.open('https://linktr.ee/FarhanOnChain', '_blank')
      );
    }
  }

  fetchAndRender();
  // Refresh every 20s so pending/completed status stays current
  setInterval(fetchAndRender, 20000);
}

// ── CONFIRM PAGE ──
async function initConfirmPage() {
  const token    = new URLSearchParams(location.search).get('token');
  const loading  = document.getElementById('confirm-loading');
  const notFound = document.getElementById('not-found');
  const cardEl   = document.getElementById('confirm-card-content');

  if (!token) {
    if (loading)  loading.style.display  = 'none';
    if (notFound) notFound.style.display = 'block';
    return;
  }

  try {
    const wishes = await apiGet();
    const wish   = wishes.find(w => String(w.claim_token || '').trim() === token.trim());

    if (loading) loading.style.display = 'none';

    if (!wish) {
      if (notFound) notFound.style.display = 'block';
      return;
    }

    cardEl.style.display = 'block';
    document.getElementById('c-text').textContent   = wish.text   || '';
    document.getElementById('c-name').textContent   = wish.name   || 'Anon';
    document.getElementById('c-amount').textContent = wish.amount || '';

    const btnYes = document.getElementById('confirm-yes');
    const btnNo  = document.getElementById('confirm-no');
    const result = document.getElementById('confirm-result');

    const status = String(wish.status || '').toLowerCase().trim();

    if (status === 'completed') {
      btnYes.disabled = btnNo.disabled = true;
      result.textContent   = 'This wish has already been confirmed as fulfilled.';
      result.style.cssText = 'display:block;color:#357a55;margin-top:1rem;text-align:center;font-size:0.95rem;';
      return;
    }

    if (status === 'open') {
      btnYes.disabled      = true;
      result.textContent   = 'No one has marked support for this wish yet.';
      result.style.cssText = 'display:block;color:var(--ink-faint);margin-top:1rem;text-align:center;font-size:0.95rem;';
    }

    btnYes.addEventListener('click', async () => {
      btnYes.disabled = btnNo.disabled = true;
      btnYes.textContent = 'Confirming...';
      try {
        await apiPost({ action: 'updateStatus', claim_token: token, status: 'completed' });
        result.textContent   = 'Thank you. Your wish is now marked as fulfilled.';
        result.style.cssText = 'display:block;color:#357a55;margin-top:1rem;text-align:center;font-size:0.95rem;';
        btnYes.textContent   = 'Confirmed';
      } catch {
        btnYes.disabled = btnNo.disabled = false;
        btnYes.textContent   = 'I received this support';
        result.textContent   = 'Something went wrong. Please try again.';
        result.style.cssText = 'display:block;color:#c0624a;margin-top:1rem;text-align:center;font-size:0.95rem;';
      }
    });

    btnNo.addEventListener('click', async () => {
      btnYes.disabled = btnNo.disabled = true;
      btnNo.textContent = 'Noting...';
      try {
        await apiPost({ action: 'updateStatus', claim_token: token, status: 'open' });
        result.textContent   = 'Noted. Your wish is back to open so others can try again.';
        result.style.cssText = 'display:block;color:var(--ink-faint);margin-top:1rem;text-align:center;font-size:0.95rem;';
        btnNo.textContent    = 'Done';
      } catch {
        btnYes.disabled = btnNo.disabled = false;
        btnNo.textContent    = 'I did not receive anything';
        result.textContent   = 'Something went wrong. Please try again.';
        result.style.cssText = 'display:block;color:#c0624a;margin-top:1rem;text-align:center;font-size:0.95rem;';
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
  document.querySelectorAll('.orb-3,.orb-4,.orb-5').forEach(o => o.remove());
  document.querySelectorAll('.orb-1,.orb-2').forEach(o => {
    o.style.filter            = 'blur(55px)';
    o.style.opacity           = '0.22';
    o.style.animationDuration = '70s';
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
