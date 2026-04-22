// ── FundAWish ──

const SUPABASE_URL = 'https://rbajkwcloftmbadgpawl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Usq3uDd9xPzgqVSpP0bs7w_oQhpI4gI';

const WISHES_DB   = `${SUPABASE_URL}/rest/v1/wishes`;
const SUPPORTS_DB = `${SUPABASE_URL}/rest/v1/supports`;

const HEADERS = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
};

const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

// ── Token generator ──
function generateToken() {
  if (crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// ── Helpers ──
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
  );
}

// Prefix amount with $ if it looks purely numeric, otherwise leave as-is
function fmtAmount(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  // If already has a currency symbol or letters, keep it
  if (/[a-zA-Z$£€¥₹]/.test(s)) return s;
  return '$' + s;
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

// ── Supabase API ──

async function apiGetWishes() {
  const res = await fetch(`${WISHES_DB}?select=*&order=created_at.desc`, {
    method: 'GET', headers: HEADERS,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.message || `GET wishes failed: ${res.status}`);
  }
  return await res.json();
}

async function apiCreateWish(wish) {
  const res = await fetch(WISHES_DB, {
    method:  'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body:    JSON.stringify(wish),
  });
  if (!res.ok) {
    const e   = await res.json().catch(() => ({}));
    const msg = e.message || e.error_description || e.hint || JSON.stringify(e) || 'Insert failed';
    throw new Error(`[${res.status}] ${msg}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function apiUpdateWishStatus(claim_token, status) {
  const res = await fetch(
    `${WISHES_DB}?claim_token=eq.${encodeURIComponent(claim_token)}`,
    {
      method:  'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ status }),
    }
  );
  if (!res.ok) {
    const e   = await res.json().catch(() => ({}));
    const msg = e.message || e.error_description || e.hint || JSON.stringify(e) || 'Update failed';
    throw new Error(`[${res.status}] ${msg}`);
  }
  return true;
}

// PATCH status + supporter info in one call
async function apiUpdateWishStatusWithSupporter(claim_token, status, supporter_name, supporter_x) {
  const res = await fetch(
    `${WISHES_DB}?claim_token=eq.${encodeURIComponent(claim_token)}`,
    {
      method:  'PATCH',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body:    JSON.stringify({ status, supporter_name, supporter_x }),
    }
  );
  if (!res.ok) {
    const e   = await res.json().catch(() => ({}));
    const msg = e.message || e.error_description || e.hint || JSON.stringify(e) || 'Update failed';
    throw new Error(`[${res.status}] ${msg}`);
  }
  return true;
}

// Insert a support record into the `supports` table
async function apiCreateSupport(support) {
  const res = await fetch(SUPPORTS_DB, {
    method:  'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body:    JSON.stringify(support),
  });
  if (!res.ok) {
    const e   = await res.json().catch(() => ({}));
    const msg = e.message || e.hint || JSON.stringify(e) || 'Support insert failed';
    throw new Error(`[${res.status}] ${msg}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

// Fetch all supports for leaderboard
async function apiGetSupports() {
  const res = await fetch(`${SUPPORTS_DB}?select=*&order=created_at.desc`, {
    method: 'GET', headers: HEADERS,
  });
  if (!res.ok) return []; // leaderboard is non-critical
  return await res.json();
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
  err.textContent      = msg;
  el.style.borderColor = msg ? '#c0624a' : '';
  el.style.boxShadow   = msg ? '0 0 0 3px rgba(192,98,74,0.12)' : '';
}

function clearFieldError(id) { setFieldError(id, ''); }

// ── MODAL ──
// Single modal instance, reused for every wish
let _modalWish       = null; // the wish currently shown in modal
let _onSentCallback  = null; // called when "I have sent support" is confirmed

function buildModal() {
  if (document.getElementById('support-modal')) return; // already exists

  const overlay = document.createElement('div');
  overlay.id = 'support-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:none;align-items:center;justify-content:center;
    padding:1.5rem;
    background:rgba(45,31,26,0.45);
    backdrop-filter:blur(6px);
    -webkit-backdrop-filter:blur(6px);
  `;

  overlay.innerHTML = `
    <div class="card" id="support-modal-card" style="
      max-width:480px;width:100%;position:relative;
      animation:modalIn 0.25s ease;
    ">
      <style>
        @keyframes modalIn {
          from { opacity:0; transform:translateY(16px) scale(0.97); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      </style>

      <span class="label-tag" id="modal-label">Support</span>
      <div class="card-title" style="margin-bottom:1.2rem;" id="modal-title">Review this wish</div>

      <!-- Wish detail -->
      <div class="confirm-wish-text" id="modal-text" style="margin-bottom:1.2rem;"></div>

      <div style="display:flex;flex-direction:column;gap:0.55rem;margin-bottom:1.4rem;font-size:0.92rem;color:var(--ink-soft);">
        <div><span style="color:var(--ink-faint);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:2px;">From</span>
          <span id="modal-name" style="font-weight:500;color:var(--ink);"></span></div>
        <div><span style="color:var(--ink-faint);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:2px;">Amount</span>
          <span id="modal-amount" class="amount-badge" style="font-size:0.92rem;"></span></div>
        <div><span style="color:var(--ink-faint);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:2px;">X Handle</span>
          <a id="modal-x" class="wish-x" href="#" target="_blank" rel="noopener" style="font-size:0.95rem;"></a></div>
      </div>

      <!-- Wallet -->
      <div class="wallet-reveal" style="margin-bottom:1.4rem;">
        <p class="wallet-label">Send to this wallet</p>
        <div class="wallet-box">
          <code class="wallet-addr" id="modal-wallet"></code>
          <button class="btn btn-secondary" id="modal-copy-wallet" style="padding:6px 14px;font-size:0.82rem;flex-shrink:0;">Copy</button>
        </div>
      </div>

      <!-- Supporter fields -->
      <div id="modal-supporter-fields" style="margin-bottom:1.2rem;">
        <div class="form-group" style="margin-bottom:0.8rem;">
          <label class="form-label" for="modal-sup-name">Your name <span style="color:var(--ink-faint);font-size:0.72rem;text-transform:none;letter-spacing:0;">(optional)</span></label>
          <input class="form-input" id="modal-sup-name" type="text" placeholder="Leave blank to appear as Anon" style="padding:10px 14px;font-size:0.92rem;" />
        </div>
        <div class="form-group">
          <label class="form-label" for="modal-sup-x">Your X handle <span style="color:var(--ink-faint);font-size:0.72rem;text-transform:none;letter-spacing:0;">(optional)</span></label>
          <input class="form-input" id="modal-sup-x" type="text" placeholder="your X username" style="padding:10px 14px;font-size:0.92rem;" />
        </div>
      </div>

      <p id="modal-status-msg" style="display:none;font-size:0.88rem;margin-bottom:0.9rem;text-align:center;"></p>

      <div style="display:flex;flex-direction:column;gap:0.8rem;">
        <button class="btn btn-primary btn-full" id="modal-confirm-btn">I have sent the support</button>
        <button class="btn btn-outline btn-full" id="modal-close-btn">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Close on overlay click (not card click)
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  document.getElementById('modal-copy-wallet').addEventListener('click', () => {
    if (_modalWish) copyText(_modalWish.wallet, document.getElementById('modal-copy-wallet'));
  });

  document.getElementById('modal-confirm-btn').addEventListener('click', async () => {
    if (!_modalWish) return;

    const confirmBtn = document.getElementById('modal-confirm-btn');
    const statusMsg  = document.getElementById('modal-status-msg');
    const supName    = document.getElementById('modal-sup-name').value.trim(); // empty = anonymous
    const supX       = document.getElementById('modal-sup-x').value.trim();
    console.log('[FundAWish] supporter name:', supName || '(anonymous)', '| x:', supX || '(none)');

    confirmBtn.disabled    = true;
    confirmBtn.textContent = 'Recording...';
    statusMsg.style.display = 'none';

    try {
      // 1. Try to insert support record — non-fatal if supports table missing
      try {
        await apiCreateSupport({
          wish_id:        _modalWish.id,
          supporter_name: supName,
          supporter_x:    supX,
          amount:         _modalWish.amount,
        });
      } catch (supportErr) {
        // Log but don't block — supports table may not exist yet
        console.warn('supports insert skipped:', supportErr.message);
      }

      // 2. Mark wish as pending + store supporter info
      // Pass supName as-is — empty string means anonymous, named string means named
      await apiUpdateWishStatusWithSupporter(
        _modalWish.claim_token, 'pending', supName, supX
      );

      // 3. Notify the card and close
      if (typeof _onSentCallback === 'function') _onSentCallback(_modalWish);
      closeModal();

    } catch (err) {
      console.error('modal confirm error:', err);
      confirmBtn.disabled    = false;
      confirmBtn.textContent = 'I have sent the support';
      // Show the REAL error so we can debug it
      statusMsg.textContent  = err.message || 'Something went wrong. Please try again.';
      statusMsg.style.cssText = 'display:block;color:#c0624a;font-size:0.85rem;margin-bottom:0.9rem;text-align:center;line-height:1.5;';
    }
  });
}

function openModal(wish, onSentCallback) {
  _modalWish      = wish;
  _onSentCallback = onSentCallback;

  document.getElementById('modal-text').textContent   = wish.text   || '';
  document.getElementById('modal-name').textContent   = wish.name   || 'Anon';
  document.getElementById('modal-amount').textContent = fmtAmount(wish.amount);
  document.getElementById('modal-wallet').textContent = wish.wallet || '';

  const xEl   = document.getElementById('modal-x');
  xEl.textContent = wish.x_handle ? '@' + wish.x_handle : 'Not provided';
  xEl.href        = wish.x_handle ? 'https://x.com/' + encodeURIComponent(wish.x_handle) : '#';

  // Reset supporter fields and status msg
  document.getElementById('modal-sup-name').value    = '';
  document.getElementById('modal-sup-x').value       = '';
  document.getElementById('modal-status-msg').style.display = 'none';
  const confirmBtn = document.getElementById('modal-confirm-btn');
  confirmBtn.disabled    = false;
  confirmBtn.textContent = 'I have sent the support';

  const overlay = document.getElementById('support-modal');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.getElementById('support-modal');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
  _modalWish      = null;
  _onSentCallback = null;
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
      const claim_token = generateToken();

      const inserted = await apiCreateWish({
        name, text, amount, wallet,
        x_handle:    x,
        status:      'open',
        claim_token,
      });

      const token      = (inserted && inserted.claim_token) || claim_token;
      const base       = location.href.split('?')[0].replace(/make\.html$/, '');
      const confirmUrl = base + 'confirm.html?token=' + token;

      form.style.display    = 'none';
      success.style.display = 'block';

      document.getElementById('confirm-link').textContent = confirmUrl;
      document.getElementById('copy-btn').onclick = () =>
        copyText(confirmUrl, document.getElementById('copy-btn'));

    } catch (err) {
      btn.disabled    = false;
      btn.textContent = 'Share my wish';
      const topErr = document.getElementById('form-top-error');
      if (topErr) {
        topErr.textContent   = 'Error: ' + (err.message || 'Could not submit. Check your connection.');
        topErr.style.display = 'block';
      }
      console.error('createWish error:', err);
    }
  });
}

// ── FULFILL PAGE ──
function initFulfillPage() {
  const grid      = document.getElementById('wishes-grid');
  const lbSection = document.getElementById('leaderboard-section');
  const lbGrid    = document.getElementById('lb-grid');
  if (!grid) return;

  buildModal(); // create modal DOM once

  grid.innerHTML = '<div class="empty-state"><p style="opacity:0.5;">Loading wishes...</p></div>';

  async function fetchAndRender() {
    try {
      const wishes = await apiGetWishes();
      render(normalise(wishes));
    } catch (err) {
      console.error('fetchAndRender error:', err);
      grid.innerHTML = '<div class="empty-state"><p>Could not load wishes. Try again soon.</p></div>';
    }
  }

  function normalise(wishes) {
    return wishes.map(w => ({
      id:             String(w.id             || ''),
      name:           String(w.name           || 'Anon'),
      text:           String(w.text           || ''),
      amount:         String(w.amount         || ''),
      wallet:         String(w.wallet         || ''),
      x_handle:       String(w.x_handle       || ''),
      claim_token:    String(w.claim_token    || ''),
      status:         String(w.status         || 'open').toLowerCase().trim(),
      supporter_name: String(w.supporter_name || '').trim(),
      supporter_x:    String(w.supporter_x    || '').trim(),
      created_at:     w.created_at            || '',
    }));
  }

  function render(wishes) {
    // Show open AND pending — only hide completed
    const visible = wishes.filter(w => w.status === 'open' || w.status === 'pending');
    grid.innerHTML = '';

    if (!visible.length) {
      grid.innerHTML = '<div class="empty-state"><p>No open wishes right now. Be the first to share one.</p></div>';
    } else {
      visible.forEach(w => grid.appendChild(buildWishCard(w)));
    }

    renderLeaderboard(wishes, lbSection, lbGrid);
    initReveal();
  }

  function buildWishCard(w) {
    const div     = document.createElement('div');
    div.className = 'wish-card reveal';

    const isPending = w.status === 'pending';

    const xLine = w.x_handle
      ? `<a class="wish-x" href="https://x.com/${escHtml(w.x_handle)}" target="_blank" rel="noopener">@${escHtml(w.x_handle)}</a>`
      : '';

    const badgeClass = isPending ? 'badge badge-pending' : 'badge badge-open';
    const badgeLabel = isPending ? 'Pending'             : 'Open';

    // Pending action: direct confirm buttons — no fake identity check
    const pendingAction = buildPendingAction(w);

    const actionHtml = isPending
      ? pendingAction
      : `<button class="btn btn-primary btn-full support-btn">Support this wish</button>`;

    div.innerHTML = `
      <div class="wish-card-top">
        <div class="wish-text">${escHtml(w.text)}</div>
        <div class="amount-badge">${escHtml(fmtAmount(w.amount))}</div>
      </div>
      <div class="wish-meta">
        <span class="wish-name">${escHtml(w.name)}</span>
        ${xLine}
        <span class="${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="wish-action">${actionHtml}</div>
    `;

    if (!isPending) {
      // Open support modal
      div.querySelector('.support-btn').addEventListener('click', () => {
        openModal(w, (confirmedWish) => {
          const badge       = div.querySelector('.badge');
          badge.className   = 'badge badge-pending';
          badge.textContent = 'Pending';
          // Swap action to inline confirm panel immediately
          div.querySelector('.wish-action').innerHTML = pendingAction;
          attachInlineConfirm(div, w);
        });
      });
    } else {
      // Already pending — wire up inline confirm
      attachInlineConfirm(div, w);
    }

    return div;
  }

  // Wire up the two-step inline confirm on a pending wish card.
  // Step 1: choose received / not received.
  // Step 2: enter X handle (soft trust signal, not a hard lock).
  function attachInlineConfirm(div, w) {
    const receivedBtn = div.querySelector('.inline-received-btn');
    const notRecvBtn  = div.querySelector('.inline-not-received-btn');
    const xError      = div.querySelector('.inline-x-error');
    const step1       = div.querySelector('.inline-step-1');
    const step2       = div.querySelector('.inline-step-2');
    const step2Msg    = div.querySelector('.inline-step-2-msg');
    const xInput      = div.querySelector('.inline-x-input');
    const finalBtn    = div.querySelector('.inline-final-btn');
    const backBtn     = div.querySelector('.inline-back-btn');
    if (!receivedBtn || !notRecvBtn) return;

    let pendingStatus = null; // 'completed' or 'open'

    // Step 1 — user chooses
    receivedBtn.addEventListener('click', () => showStep2('completed'));
    notRecvBtn.addEventListener('click',  () => showStep2('open'));

    function showStep2(status) {
      pendingStatus = status;
      step1.style.display    = 'none';
      step2.style.display    = 'block';
      step2Msg.textContent   = status === 'completed'
        ? 'Great! Just enter your X handle so we can log this.'
        : 'Got it. Enter your X handle so we can reopen this wish.';
      if (xError) xError.style.display = 'none';
      xInput.value = '';
      xInput.focus();
    }

    // Back to step 1
    backBtn.addEventListener('click', () => {
      step2.style.display = 'none';
      step1.style.display = 'flex';
      pendingStatus = null;
    });

    // Allow Enter key to submit
    xInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') finalBtn.click();
    });

    // Step 2 — user submits X handle
    finalBtn.addEventListener('click', async () => {
      if (!pendingStatus) return;

      const handle = xInput.value.trim().replace(/^@/, '');

      if (!handle) {
        if (xError) {
          xError.textContent   = 'Please enter your X handle to continue.';
          xError.style.display = 'block';
        }
        return;
      }

      finalBtn.disabled = backBtn.disabled = true;
      finalBtn.textContent = 'Saving...';
      if (xError) xError.style.display = 'none';

      try {
        await apiUpdateWishStatus(w.claim_token, pendingStatus);

        const actionEl = div.querySelector('.wish-action');

        if (pendingStatus === 'completed') {
          actionEl.innerHTML = `<p class="wish-waiting" style="color:#357a55;font-style:normal;font-weight:500;">Wish fulfilled. Thank you, @${escHtml(handle)}!</p>`;
          div.querySelector('.badge').className   = 'badge badge-completed';
          div.querySelector('.badge').textContent = 'Completed';
          launchCelebration(w.text);
        } else {
          actionEl.innerHTML = `<button class="btn btn-primary btn-full support-btn">Support this wish</button>`;
          div.querySelector('.badge').className   = 'badge badge-open';
          div.querySelector('.badge').textContent = 'Open';
          div.querySelector('.support-btn').addEventListener('click', () => {
            openModal(w, () => {
              div.querySelector('.badge').className   = 'badge badge-pending';
              div.querySelector('.badge').textContent = 'Pending';
              div.querySelector('.wish-action').innerHTML = buildPendingAction(w);
              attachInlineConfirm(div, w);
            });
          });
        }
      } catch (err) {
        console.error('inline confirm error:', err);
        finalBtn.disabled = backBtn.disabled = false;
        finalBtn.textContent = 'Confirm';
        if (xError) {
          xError.textContent   = err.message || 'Something went wrong. Try again.';
          xError.style.display = 'block';
        }
      }
    });
  }

  function buildPendingAction(w) {
    return `
      <div class="inline-confirm">
        <p class="wish-waiting" style="margin-bottom:0.8rem;">
          Someone sent support for this wish.
          <br><span style="font-size:0.82rem;opacity:0.8;">If you are <strong>${escHtml(w.name)}</strong> and received it, confirm below.</span>
        </p>
        <p class="inline-x-error" style="display:none;color:#c0624a;font-size:0.8rem;margin-bottom:0.5rem;"></p>
        <!-- Step 1: choice buttons -->
        <div class="inline-step-1" style="display:flex;gap:0.6rem;flex-wrap:wrap;">
          <button class="btn btn-primary inline-received-btn" style="flex:1;padding:10px 14px;font-size:0.88rem;">
            I received it
          </button>
          <button class="btn btn-outline inline-not-received-btn" style="flex:1;padding:10px 14px;font-size:0.88rem;">
            I did not receive it
          </button>
        </div>
        <!-- Step 2: x handle input (shown after choosing) -->
        <div class="inline-step-2" style="display:none;margin-top:0.7rem;">
          <p class="inline-step-2-msg" style="font-size:0.85rem;color:var(--ink-soft);margin-bottom:0.6rem;"></p>
          <div style="display:flex;gap:0.6rem;flex-wrap:wrap;align-items:center;">
            <input
              class="form-input inline-x-input"
              type="text"
              placeholder="your X handle"
              style="padding:9px 12px;font-size:0.88rem;border-radius:10px;flex:1;min-width:120px;"
            />
            <button class="btn btn-primary inline-final-btn" style="padding:10px 18px;font-size:0.88rem;white-space:nowrap;">
              Confirm
            </button>
            <button class="btn btn-outline inline-back-btn" style="padding:10px 14px;font-size:0.88rem;">
              Back
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // Dev card expand/collapse
  const devCard = document.getElementById('dev-card');
  if (devCard) {
    const devExpanded  = document.getElementById('dev-expanded');
    const devToggleBtn = devCard.querySelector('.dev-btn');
    if (devToggleBtn) {
      devToggleBtn.addEventListener('click', () => {
        if (!devExpanded) return;
        const open = devExpanded.style.display === 'block';
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
  setInterval(fetchAndRender, 20000);

  // ── Lost confirmation link search ──
  initLostLinkSearch();
}

function initLostLinkSearch() {
  const toggle    = document.getElementById('lost-link-toggle');
  const body      = document.getElementById('lost-link-body');
  const chevron   = document.getElementById('lost-link-chevron');
  const searchBtn = document.getElementById('lost-link-search-btn');
  const xInput    = document.getElementById('lost-link-x');
  const result    = document.getElementById('lost-link-result');
  if (!toggle || !body) return;

  // Collapse/expand
  toggle.addEventListener('click', () => {
    const open = body.style.display === 'block';
    body.style.display    = open ? 'none' : 'block';
    chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
  });

  // Allow Enter key
  xInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') searchBtn.click();
  });

  searchBtn.addEventListener('click', async () => {
    const handle = xInput.value.trim().replace(/^@/, '').toLowerCase();
    if (!handle) {
      result.textContent   = 'Please enter your X handle.';
      result.style.cssText = 'display:block;color:#c0624a;';
      return;
    }

    searchBtn.disabled    = true;
    searchBtn.textContent = 'Searching...';
    result.style.display  = 'none';

    try {
      // Fetch wishes matching this x_handle
      const res = await fetch(
        `${WISHES_DB}?x_handle=ilike.${encodeURIComponent(handle)}&select=*`,
        { method: 'GET', headers: HEADERS }
      );
      const data = await res.json();
      const matches = Array.isArray(data) ? data : [];

      searchBtn.disabled    = false;
      searchBtn.textContent = 'Find my wish';

      if (!matches.length) {
        result.textContent   = 'No wishes found for @' + escHtml(handle) + '. Make sure you used the same X handle when you created the wish.';
        result.style.cssText = 'display:block;color:var(--ink-faint);';
        return;
      }

      const pending = matches.filter(w => w.status === 'pending');
      const open    = matches.filter(w => w.status === 'open');

      if (pending.length) {
        result.innerHTML = `Found <strong>${pending.length}</strong> pending wish${pending.length > 1 ? 'es' : ''} for @${escHtml(handle)}. Scroll up to find your wish and confirm it directly from the card.`;
        result.style.cssText = 'display:block;color:#357a55;line-height:1.6;';
        // Highlight matching cards on the page
        document.querySelectorAll('.wish-card').forEach(card => {
          const nameEl = card.querySelector('.wish-x');
          if (nameEl && nameEl.textContent.toLowerCase().includes(handle)) {
            card.style.outline = '2px solid var(--accent-gold)';
            card.style.outlineOffset = '3px';
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              card.style.outline = '';
              card.style.outlineOffset = '';
            }, 3500);
          }
        });
      } else if (open.length) {
        result.innerHTML = `Found <strong>${open.length}</strong> open wish${open.length > 1 ? 'es' : ''} for @${escHtml(handle)}. These are still waiting for a supporter.`;
        result.style.cssText = 'display:block;color:var(--ink-soft);line-height:1.6;';
      } else {
        result.textContent   = 'Your wish was found but it looks like it is already completed.';
        result.style.cssText = 'display:block;color:var(--ink-faint);';
      }
    } catch (err) {
      searchBtn.disabled    = false;
      searchBtn.textContent = 'Find my wish';
      result.textContent    = 'Could not search right now. Try again.';
      result.style.cssText  = 'display:block;color:#c0624a;';
    }
  });
}

// ── LEADERBOARD ──
// Each completed wish = one entry.
// Named supporters are grouped together across multiple wishes.
// Anonymous supporters are kept separate (each wish gets its own row).
function renderLeaderboard(wishes, lbSection, lbGrid) {
  if (!lbSection || !lbGrid) return;

  const completed = wishes.filter(w => w.status === 'completed');

  if (!completed.length) {
    lbSection.style.display = 'none';
    return;
  }

  // Build leaderboard entries
  // Named: group by supporter_name so one real person's multiple supports merge
  // Anonymous: each wish is its own entry (we can't know if it's the same person)
  const namedGroups = {};  // supporter_name → { total, wishes[] }
  const anonEntries = [];  // each anonymous wish as its own entry

  completed.forEach(w => {
    const rawName = String(w.supporter_name || '').trim();
    const n = parseFloat(String(w.amount || '0').replace(/[^0-9.]/g, '')) || 0;

    if (rawName) {
      // Named supporter — merge
      if (!namedGroups[rawName]) namedGroups[rawName] = { total: 0, wishes: [] };
      namedGroups[rawName].total += n;
      namedGroups[rawName].wishes.push(w);
    } else {
      // Anonymous — keep separate
      anonEntries.push({ total: n, wishes: [w] });
    }
  });

  // Combine into one sortable list
  const entries = [
    ...Object.entries(namedGroups).map(([name, data]) => ({
      label:    name,
      subLabel: data.wishes.length > 1 ? `${data.wishes.length} wishes supported` : '1 wish supported',
      total:    data.total,
      wishes:   data.wishes,
      isAnon:   false,
    })),
    ...anonEntries.map((data, i) => ({
      label:    'Anonymous',
      subLabel: '1 wish supported',
      total:    data.total,
      wishes:   data.wishes,
      isAnon:   true,
    })),
  ];

  // Sort by total amount descending
  entries.sort((a, b) => b.total - a.total);

  lbSection.style.display = 'block';
  lbGrid.innerHTML        = '';

  entries.slice(0, 10).forEach((entry, i) => {
    const rank  = i + 1;
    const isTop = rank <= 3;

    const card = document.createElement('div');
    card.className = 'lb-card reveal' + (isTop ? ' lb-top-highlight' : '');
    card.style.cursor = entry.isAnon ? 'default' : 'pointer';

    const xBadge = !entry.isAnon && entry.wishes[0] && entry.wishes[0].supporter_x
      ? `<span style="font-size:0.78rem;color:var(--accent-gold);margin-left:0.3rem;">@${escHtml(entry.wishes[0].supporter_x)}</span>`
      : '';

    const anonStyle = entry.isAnon
      ? 'opacity:0.65;font-style:italic;'
      : '';

    card.innerHTML = `
      <div class="lb-rank${isTop ? ' top' : ''}">${rank}</div>
      <div class="lb-info">
        <div class="lb-name" style="${anonStyle}">${escHtml(entry.label)}${xBadge}</div>
        <div class="lb-amount">${entry.subLabel}</div>
      </div>
      <div class="amount-badge">${entry.total > 0 ? '$' + entry.total : 'fulfilled'}</div>
    `;

    // All cards expand to show which wish was supported
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => toggleLbDetail(card, entry.wishes, entry.label));

    lbGrid.appendChild(card);
  });

  initReveal();
}

function toggleLbDetail(card, records, name) {
  const existing = card.nextSibling;
  if (existing && existing.classList && existing.classList.contains('lb-detail')) {
    existing.remove();
    return;
  }

  const detail = document.createElement('div');
  detail.className = 'lb-detail';
  detail.style.cssText = `
    background:rgba(255,255,255,0.45);border:1px solid rgba(212,164,80,0.2);
    border-radius:16px;padding:1rem 1.2rem;margin-bottom:0.5rem;
    font-size:0.88rem;color:var(--ink-soft);
    backdrop-filter:blur(12px);
  `;

  const rows = records.map(w => {
    const date = w.created_at ? new Date(w.created_at).toLocaleDateString() : '';
    return `
      <div style="padding:0.7rem 0;border-bottom:1px solid rgba(212,164,80,0.1);">
        <div style="color:var(--ink);font-family:'Lora',serif;font-size:0.95rem;line-height:1.5;margin-bottom:0.3rem;">${escHtml(w.text || '')}</div>
        <div style="display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap;font-size:0.8rem;color:var(--ink-faint);">
          <span>Wished by <strong style="color:var(--ink-soft);">${escHtml(w.name || 'Anon')}</strong></span>
          <span style="color:rgba(212,164,80,0.5);">·</span>
          <span style="color:var(--accent-gold);font-weight:600;">${escHtml(fmtAmount(w.amount))}</span>
          <span style="color:rgba(212,164,80,0.5);">·</span>
          <span>${date}</span>
        </div>
      </div>`;
  }).join('');

  const headerLabel = name === 'Anonymous' ? 'An anonymous supporter helped with' : `${escHtml(name)} supported`;
  detail.innerHTML = `<p style="font-weight:500;color:var(--ink);margin-bottom:0.4rem;font-size:0.88rem;">${headerLabel}</p>${rows}`;
  card.insertAdjacentElement('afterend', detail);
}

// ── CONFIRM PAGE ──
async function initConfirmPage() {
  const token    = new URLSearchParams(location.search).get('token');
  const loading  = document.getElementById('confirm-loading');
  const notFound = document.getElementById('not-found');
  const cardEl   = document.getElementById('confirm-card-content');

  if (!loading && !notFound && !cardEl) return; // not on confirm page

  if (!token) {
    if (loading)  loading.style.display  = 'none';
    if (notFound) notFound.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(
      `${WISHES_DB}?claim_token=eq.${encodeURIComponent(token)}&select=*&limit=1`,
      { method: 'GET', headers: HEADERS }
    );
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const data = await res.json();
    const wish = Array.isArray(data) ? data[0] : null;

    if (loading) loading.style.display = 'none';
    if (!wish)   { if (notFound) notFound.style.display = 'block'; return; }

    cardEl.style.display = 'block';
    document.getElementById('c-text').textContent   = wish.text   || '';
    document.getElementById('c-name').textContent   = wish.name   || 'Anon';
    document.getElementById('c-amount').textContent = fmtAmount(wish.amount);

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
        await apiUpdateWishStatus(token, 'completed');
        result.textContent   = 'Thank you. Your wish is now marked as fulfilled.';
        result.style.cssText = 'display:block;color:#357a55;margin-top:1rem;text-align:center;font-size:0.95rem;';
        btnYes.textContent   = 'Confirmed';
        // 🎉 Launch celebration
        launchCelebration(wish.text);
      } catch (err) {
        console.error('confirm yes:', err);
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
        await apiUpdateWishStatus(token, 'open');
        result.textContent   = 'Noted. Your wish is back to open so others can try again.';
        result.style.cssText = 'display:block;color:var(--ink-faint);margin-top:1rem;text-align:center;font-size:0.95rem;';
        btnNo.textContent    = 'Done';
      } catch (err) {
        console.error('confirm no:', err);
        btnYes.disabled = btnNo.disabled = false;
        btnNo.textContent    = 'I did not receive anything';
        result.textContent   = 'Something went wrong. Please try again.';
        result.style.cssText = 'display:block;color:#c0624a;margin-top:1rem;text-align:center;font-size:0.95rem;';
      }
    });

  } catch (err) {
    console.error('confirm page:', err);
    if (loading)  loading.style.display  = 'none';
    if (notFound) notFound.style.display = 'block';
  }
}

// ── CELEBRATION ANIMATION ──
function launchCelebration(wishText) {
  // Confetti pieces
  const colors = ['#d4a450','#ffb7a5','#f7a8b8','#fff3ec','#a0d4b0','#ffd700'];
  for (let i = 0; i < 72; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left     = Math.random() * 100 + 'vw';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width    = (Math.random() * 8 + 6) + 'px';
    piece.style.height   = (Math.random() * 8 + 6) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDuration  = (Math.random() * 2.5 + 2) + 's';
    piece.style.animationDelay     = (Math.random() * 1.2) + 's';
    piece.style.opacity = '1';
    document.body.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }

  // Central burst overlay
  const overlay = document.createElement('div');
  overlay.className = 'celebration-overlay';
  overlay.innerHTML = `
    <div class="celebration-burst">
      <div class="celebration-emoji">🌟</div>
      <div class="celebration-text">Wish fulfilled!</div>
      <div style="font-family:'DM Sans',sans-serif;font-size:1rem;color:var(--ink-soft);text-align:center;max-width:280px;line-height:1.5;margin-top:0.3rem;opacity:0.85;">
        ${escHtml(wishText || 'Someone made a difference today')}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Pulse the background orbs
  document.querySelectorAll('.orb').forEach(o => {
    o.style.transition = 'opacity 0.4s';
    o.style.opacity = '0.7';
    setTimeout(() => { o.style.opacity = ''; o.style.transition = ''; }, 1800);
  });

  // Remove after animation completes
  setTimeout(() => overlay.remove(), 3400);
}

// ── Mobile ──
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
