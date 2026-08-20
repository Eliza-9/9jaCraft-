let selected = null;

const $ = id => document.getElementById(id);
const results = $("results");

async function loadArtisans() {
  const params = new URLSearchParams({
    q: $("q").value,
    state: $("state").value,
    lga: $("lga").value
  });

  try {
    const artisans = await fetch("/api/artisans?" + params).then(r => r.json());

    $("count").textContent =
      `${artisans.length} artisan${artisans.length === 1 ? "" : "s"} found`;

    results.innerHTML = artisans.length
      ? artisans.map(a => `
        <article class="card">
          <div class="top">
            <div class="avatar">${a.profession[0]}</div>
            <div>
              <h3>${a.name}</h3>
              <div class="profession">${a.profession}</div>
            </div>
          </div>

          <div class="rating">★ ${a.rating}</div>
          <p class="meta">📍 ${a.location}, ${a.lga}, ${a.state}</p>
          <p class="meta">${a.experience} years experience</p>

          <p class="${a.available ? "available" : "unavailable"}">
            ${a.available ? "● Available" : "● Currently unavailable"}
          </p>

          <p class="bio">${a.bio}</p>

          <div class="actions">
            <button class="book" onclick="openBooking(${a.id})">
              Book Artisan
            </button>

            <button class="wa" onclick="whatsapp('${a.phone}')">
              WhatsApp
            </button>
          </div>
        </article>
      `).join("")
      : `
        <div class="empty">
          <h3>No artisans found</h3>
          <p>Try another service, state or LGA.</p>
        </div>
      `;
  } catch (error) {
    results.innerHTML = `
      <div class="empty">
        <h3>Unable to load artisans</h3>
        <p>Please refresh and try again.</p>
      </div>
    `;
  }
}

async function openBooking(id) {
  selected = await fetch("/api/artisans/" + id).then(r => r.json());

  $("modalTitle").textContent = `Book ${selected.name}`;
  $("msg").textContent = "";
  $("modal").style.display = "flex";
}

function closeModal() {
  $("modal").style.display = "none";
}

function whatsapp(phone) {
  window.open(
    "https://wa.me/234" + phone.replace(/^0/, ""),
    "_blank"
  );
}

$("searchBtn").onclick = loadArtisans;

$("q").onkeydown = e => {
  if (e.key === "Enter") loadArtisans();
};

$("lga").onkeydown = e => {
  if (e.key === "Enter") loadArtisans();
};

$("close").onclick = closeModal;

$("modal").onclick = e => {
  if (e.target === $("modal")) closeModal();
};

$("form").onsubmit = async e => {
  e.preventDefault();

  const body = {
    artisanId: selected.id,
    customerName: $("customerName").value,
    customerPhone: $("customerPhone").value,
    service: $("service").value,
    bookingDate: $("date").value,
    bookingTime: $("time").value,
    location: $("location").value,
    notes: $("notes").value
  };

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Booking failed.");
    }

    $("msg").textContent =
      `Booking #${data.bookingId} submitted. Status: ${data.status}.`;

    $("form").reset();

  } catch (error) {
    $("msg").textContent = error.message;
  }
};

loadArtisans();
