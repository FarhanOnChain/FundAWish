const API_URL = "https://script.google.com/macros/s/AKfycbwBYjBr4tazs_a2hW8r0AR7HI_0QWD0v4xmz8hM3arS4aljltPrHLzF9LVmW-E6XiMoVg/exec";

// ✅ SEND DATA (WORKING METHOD)
async function apiSend(data) {
  const url = API_URL + "?payload=" + encodeURIComponent(JSON.stringify(data));
  const res = await fetch(url);
  return res.json();
}

// ✅ FETCH WISHES
async function fetchWishes() {
  try {
    const res = await fetch(API_URL + "?action=getWishes");
    const data = await res.json();

    console.log("DATA:", data);

    const wishes = (data.wishes || []).map(w => ({
      ...w,
      status: (w.status || "").toLowerCase().trim()
    }));

    renderWishes(wishes.filter(w => w.status === "open"));

  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}

// ✅ SUBMIT WISH
async function submitWish(e) {
  e.preventDefault();

  const name = document.getElementById("name").value;
  const text = document.getElementById("text").value;
  const amount = document.getElementById("amount").value;
  const wallet = document.getElementById("wallet").value;
  const x = document.getElementById("x_handle").value;

  // WALLET VALIDATION
  const walletRegex = /^0x[a-fA-F0-9]{40}$/;
  if (!walletRegex.test(wallet)) {
    alert("Invalid wallet address");
    return;
  }

  try {
    const res = await apiSend({
      action: "createWish",
      name,
      text,
      amount,
      wallet,
      x_handle: x
    });

    console.log("SUBMIT:", res);

    alert("Wish submitted!");
    window.location.href = "index.html";

  } catch (err) {
    console.error(err);
    alert("Failed to submit");
  }
}

// ✅ SIMPLE RENDER
function renderWishes(wishes) {
  const container = document.getElementById("wishes");
  if (!container) return;

  container.innerHTML = "";

  wishes.forEach(w => {
    const card = document.createElement("div");
    card.className = "wish-card";

    card.innerHTML = `
      <h3>${w.text}</h3>
      <p>💰 ${w.amount}</p>
      <p>👤 ${w.name}</p>
      <p>𝕏 @${w.x_handle}</p>
    `;

    container.appendChild(card);
  });
}

// AUTO LOAD
document.addEventListener("DOMContentLoaded", () => {
  fetchWishes();

  const form = document.getElementById("wishForm");
  if (form) {
    form.addEventListener("submit", submitWish);
  }
});
