// ── FundAWish ──
const API_URL = 'https://script.google.com/macros/s/AKfycbxhWvdsBSF73qCbSCPtaOq95LVb3irtGAv5mSAFCu7FpkUFUnkWVgXnljcTxmaWvqrp4w/exec';

const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;

// ── Helpers ──
function escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])
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
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  });
}

// ── API ──
async function apiGet() {
  const res = await fetch(API_URL + '?action=getWishes');
  const data = await res.json();
  if (!data.success) throw new Error('Failed to load wishes');
  return data.wishes || [];
}

async function apiPost(body) {
  const encoded = encodeURIComponent(JSON.stringify(body));
  const res = await fetch(API_URL + '?payload=' + encoded);
  const data = await res.json();
  if (!data.success) throw new Error('Request failed');
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
    err.style.cssText = 'color:#c0624a;font-size:0.85rem;margin-top:4px;display:block;';
    el.parentNode.appendChild(err);
  }

  err.textContent = msg;
  el.style.borderColor = msg ? '#c0624a' : '';
}

function clearFieldError(id) {
  setFieldError(id, '');
}

// ── MAKE PAGE ──
function initMakePage() {
  const form = document.getElementById('wish-form');
  const success = document.getElementById('success-area');
  if (!form) return;

  ['f-name','f-text','f-amount','f-x','f-wallet'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearFieldError(id));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    let error = false;

    const name   = document.getElementById('f-name').value.trim() || 'Anon';
    const text   = document.getElementById('f-text').value.trim();
    const amount = document.getElementById('f-amount').value.trim();
    const x      = document.getElementById('f-x').value.trim();
    const wallet = document.getElementById('f-wallet').value.trim();

    if (!text)   { setFieldError('f-text', 'Required'); error = true; }
    if (!amount) { setFieldError('f-amount', 'Required'); error = true; }
    if (!x)      { setFieldError('f-x', 'X handle required'); error = true; }
    if (!wallet) { setFieldError('f-wallet', 'Wallet required'); error = true; }
    if (wallet && !EVM_REGEX.test(wallet)) {
      setFieldError('f-wallet', 'Invalid wallet');
      error = true;
    }

    if (error) return;

    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Sharing...';

    try {
      const res = await apiPost({
        action: 'createWish',
        name,
        text,
        amount,
        wallet,
        x_handle: x
      });

      const url = location.origin + '/confirm.html?token=' + res.claim_token;

      form.style.display = 'none';
      success.style.display = 'block';

      document.getElementById('confirm-link').textContent = url;
      document.getElementById('copy-btn').onclick = () => copyText(url, document.getElementById('copy-btn'));

    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Share Wish';
      alert('Failed to submit wish');
    }
  });
}

// ── FULFILL PAGE ──
function initFulfillPage() {
  const grid = document.getElementById('wishes-grid');
  const lb   = document.getElementById('leaderboard-section');
  const lbg  = document.getElementById('lb-grid');
  if (!grid) return;

  grid.innerHTML = '<p style="opacity:0.5;">Loading...</p>';

  async function fetchWishes() {
    try {
      const wishes = await apiGet();

      const clean = wishes.map(w => ({
        ...w,
        status: (w.status || '').toLowerCase().trim()
      }));

      render(clean);
    } catch (e) {
      grid.innerHTML = '<p>Failed to load wishes</p>';
    }
  }

  function render(wishes) {
    const open = wishes.filter(w => w.status === 'open');

    grid.innerHTML = '';

    if (!open.length) {
      grid.innerHTML = '<p>No wishes yet</p>';
    } else {
      open.forEach(w => grid.appendChild(card(w)));
    }

    const completed = wishes.filter(w => w.status === 'completed');

    if (completed.length && lb && lbg) {
      lb.style.display = 'block';

      const map = {};
      completed.forEach(w => {
        const n = w.name || 'Anon';
        const a = parseFloat(w.amount) || 0;
        map[n] = (map[n] || 0) + a;
      });

      lbg.innerHTML = '';

      Object.entries(map)
        .sort((a,b) => b[1]-a[1])
        .slice(0,10)
        .forEach(([name,total],i) => {
          const div = document.createElement('div');
          div.className = 'lb-card reveal';
          div.innerHTML = `
            <div>${i+1}</div>
            <div>${escHtml(name)}</div>
            <div>${total.toFixed(0)}</div>
          `;
          lbg.appendChild(div);
        });
    } else if (lb) {
      lb.style.display = 'none';
    }

    initReveal();
  }

  function card(w) {
    const div = document.createElement('div');
    div.className = 'wish-card reveal';

    div.innerHTML = `
      <div>${escHtml(w.text)}</div>
      <div>${escHtml(w.amount)}</div>
      <div>${escHtml(w.name)}</div>
      <button>Support</button>
    `;

    div.querySelector('button').onclick = async () => {
      await apiPost({
        action: 'updateStatus',
        claim_token: w.claim_token,
        status: 'pending'
      });

      div.innerHTML = `<p>Pending support...</p>`;
    };

    return div;
  }

  fetchWishes();
  setInterval(fetchWishes, 15000);
}

// ── CONFIRM PAGE ──
async function initConfirmPage() {
  const token = new URLSearchParams(location.search).get('token');
  if (!token) return;

  const wishes = await apiGet();
  const w = wishes.find(x => x.claim_token === token);
  if (!w) return;

  document.getElementById('c-text').textContent = w.text;
  document.getElementById('c-name').textContent = w.name;
  document.getElementById('c-amount').textContent = w.amount;

  document.getElementById('confirm-yes').onclick = async () => {
    await apiPost({
      action: 'updateStatus',
      claim_token: token,
      status: 'completed'
    });
    alert('Confirmed');
  };

  document.getElementById('confirm-no').onclick = async () => {
    await apiPost({
      action: 'updateStatus',
      claim_token: token,
      status: 'open'
    });
    alert('Marked as not received');
  };
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  initMakePage();
  initFulfillPage();
  initConfirmPage();
  initReveal();
});
