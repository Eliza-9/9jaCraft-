let selectedArtisan = null;
const pendingRatings = {};

function showDashboard() {
  switchPage("dashboardPage");
  loadDashboardExtras();
}

async function loadDashboardExtras() {
  try {
    const bookingsRes = await fetch("/api/bookings", { headers: { "Authorization": `Bearer ${authToken}` } });
    const bookings = await bookingsRes.json();

    const counts = { Pending: 0, Accepted: 0, Completed: 0 };
    bookings.forEach(b => { if (counts[b.status] !== undefined) counts[b.status]++; });

    const statsContainer = document.getElementById("dashboardStats");
    if (statsContainer) {
      statsContainer.innerHTML = `
        <div class="stat-card">
          <span class="stat-number">${counts.Pending}</span>
          <span class="stat-label">Pending</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">${counts.Accepted}</span>
          <span class="stat-label">Accepted</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">${counts.Completed}</span>
          <span class="stat-label">Completed</span>
        </div>
      `;
    }
  } catch (error) {
    console.error("Failed to load dashboard stats", error);
  }

  if (currentUser.role === "artisan") {
    try {
      const profileRes = await fetch("/api/me/artisan-profile", { headers: { "Authorization": `Bearer ${authToken}` } });
      const profile = await profileRes.json();
      const summaryContainer = document.getElementById("dashboardArtisanSummary");
      if (!summaryContainer) return;

      if (!profile) {
        summaryContainer.innerHTML = `
          <div class="dashboard-card cta-card">
            <h3>You haven't created your listing yet</h3>
            <p>Customers can't find you until you set up your artisan profile.</p>
            <button class="btn btn-primary" onclick="showProfile()">Create Listing</button>
          </div>
        `;
      } else {
        summaryContainer.innerHTML = `
          <div class="dashboard-card artisan-summary-card">
            <div class="artisan-summary-header">
              <h3>${profile.profession} ${profile.verified ? '<span class="verified-badge" title="Verified">✔️</span>' : ''}</h3>
              <span class="artisan-status ${profile.available ? 'available' : 'unavailable'}">${profile.available ? '● Available' : '● Unavailable'}</span>
            </div>
            <div class="artisan-rating">⭐ ${profile.rating}${profile.review_count ? ` (${profile.review_count} reviews)` : ' (no reviews yet)'}</div>
            <p class="artisan-meta">📍 ${profile.location}${profile.city ? ', ' + profile.city : ''}, ${profile.lga}, ${profile.state}</p>
            <button class="btn btn-outline" onclick="showProfile()">Edit Listing</button>
          </div>
        `;
      }
    } catch (error) {
      console.error("Failed to load artisan summary", error);
    }
  }
}

function showProfile() {
  switchPage("profilePage");
  loadMyProfile();
}

function showArtisans() {
  switchPage("artisansPage");
  searchArtisans();
}

function showBookings() {
  switchPage("bookingsPage");
  loadBookings();
}

function switchPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(pageId).classList.add("active");

  document.querySelectorAll(".bottom-nav-item").forEach(item => {
    item.classList.toggle("active", item.dataset.page === pageId);
  });
}

function showResponseModal(message, type = "success") {
  const modal = document.getElementById("responseModal");
  const icon = document.getElementById("responseIcon");
  const msg = document.getElementById("responseMessage");

  icon.textContent = type === "success" ? "✅" : "⚠️";
  icon.className = `response-icon ${type}`;
  msg.textContent = message;

  modal.classList.add("active");
}

function closeResponseModal() {
  document.getElementById("responseModal").classList.remove("active");
}

function toggleOtherProfession() {
  const select = document.getElementById("profileProfession");
  const group = document.getElementById("otherProfessionGroup");
  group.style.display = select.value === "Other" ? "block" : "none";
}

async function loadMyProfile() {
  try {
    const response = await fetch("/api/me/artisan-profile", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    const profile = await response.json();
    if (!profile) return;

    const knownTrades = ["Plumber","Electrician","Carpenter","Painter","Mechanic","Tailor","Hairdresser/Barber","Mason/Bricklayer","Welder","AC Repair Technician","Generator Repair Technician","Cleaner","Photographer","Caterer"];

    if (knownTrades.includes(profile.profession)) {
      document.getElementById("profileProfession").value = profile.profession;
    } else {
      document.getElementById("profileProfession").value = "Other";
      document.getElementById("profileProfessionOther").value = profile.profession;
      toggleOtherProfession();
    }

    document.getElementById("profileState").value = profile.state || "";
    document.getElementById("profileLga").value = profile.lga || "";
    document.getElementById("profileLocation").value = profile.location || "";
    document.getElementById("profileCity").value = profile.city || "";
    document.getElementById("profileArea").value = profile.area || "";
    document.getElementById("profilePriceRange").value = profile.price_range || "";
    document.getElementById("profileExperience").value = profile.experience || "";
    document.getElementById("profileBio").value = profile.bio || "";
  } catch (error) {
    console.error("Failed to load profile", error);
  }
}

document.getElementById("artisanProfileForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const professionSelect = document.getElementById("profileProfession").value;
  const profession = professionSelect === "Other"
    ? document.getElementById("profileProfessionOther").value
    : professionSelect;

  const payload = {
    profession,
    state: document.getElementById("profileState").value,
    lga: document.getElementById("profileLga").value,
    location: document.getElementById("profileLocation").value,
    city: document.getElementById("profileCity").value,
    area: document.getElementById("profileArea").value,
    price_range: document.getElementById("profilePriceRange").value,
    experience: parseInt(document.getElementById("profileExperience").value) || 0,
    bio: document.getElementById("profileBio").value
  };

  if (!profession) {
    showResponseModal("Please select or enter your trade", "error");
    return;
  }

  try {
    const response = await fetch("/api/artisans", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      showResponseModal(data.error || "Failed to save listing", "error");
      return;
    }

    showResponseModal(data.message, "success");
  } catch (error) {
    showResponseModal("Failed to save listing: " + error.message, "error");
  }
});

async function searchArtisans() {
  const q = document.getElementById("searchQuery").value;
  const state = document.getElementById("stateFilter").value;
  const lga = document.getElementById("lgaFilter").value;
  const sortEl = document.getElementById("sortFilter");
  const sort = sortEl ? sortEl.value : "rating";

  try {
    const params = new URLSearchParams({ q, state, lga, sort });
    const response = await fetch(`/api/artisans?${params}`, {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    const artisans = await response.json();
    renderArtisans(artisans);
  } catch (error) {
    console.error("Search failed", error);
    document.getElementById("artisansList").innerHTML = "<p>Failed to load artisans</p>";
  }
}

function renderArtisans(artisans) {
  const container = document.getElementById("artisansList");

  if (artisans.length === 0) {
    container.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 40px;'>No artisans found. Try different search terms.</p>";
    return;
  }

  container.innerHTML = artisans.map(a => `
    <div class="artisan-card">
      <div class="artisan-header">
        <div class="artisan-avatar">${a.profession.charAt(0).toUpperCase()}</div>
        <div class="artisan-title">
          <h3>${a.name} ${a.verified ? '<span class="verified-badge" title="Verified">✔️</span>' : ''}</h3>
          <p>${a.profession}</p>
        </div>
      </div>
      <div class="artisan-body">
        <div class="artisan-rating">⭐ ${a.rating}${a.review_count ? ` (${a.review_count} review${a.review_count === 1 ? '' : 's'})` : ' (no reviews yet)'}</div>
        <div class="artisan-meta">📍 ${a.location}${a.area ? ', ' + a.area : ''}${a.city ? ', ' + a.city : ''}, ${a.lga}, ${a.state}</div>
        <div class="artisan-meta">👤 ${a.experience} years experience</div>
        ${a.price_range ? `<div class="artisan-meta">💰 ${a.price_range}</div>` : ""}
        <div class="artisan-status ${a.available ? 'available' : 'unavailable'}">
          ${a.available ? '● Available' : '● Currently unavailable'}
        </div>
        <p class="artisan-bio">${a.bio}</p>
        ${a.recent_reviews && a.recent_reviews.length > 0 ? `
          <div class="review-snippets">
            ${a.recent_reviews.map(r => `
              <div class="review-snippet">
                <span class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
                ${r.comment ? `<span class="review-comment">"${r.comment}"</span>` : ""}
              </div>
            `).join("")}
          </div>
        ` : ""}
        <div class="artisan-actions">
          <button class="btn btn-primary" onclick="openBookingModal(${a.id}, '${a.name}')">Book</button>
          ${a.phone ? `<a href="https://wa.me/234${a.phone.replace(/^0/, '')}" target="_blank" class="btn btn-outline">WhatsApp</a>` : `<span style="display:inline-block; padding:8px 16px; background:#f0f0f0; color:#666; border-radius:6px; font-size:14px;" title="Contact available after booking">🔒 WhatsApp after booking</span>`}
        </div>
      </div>
    </div>
  `).join("");
}

function openBookingModal(artisanId, artisanName) {
  selectedArtisan = { id: artisanId, name: artisanName };
  document.getElementById("bookingModal").classList.add("active");
}

function closeModal() {
  document.getElementById("bookingModal").classList.remove("active");
  document.getElementById("bookingForm").reset();
}

document.getElementById("bookingForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const booking = {
    artisan_id: selectedArtisan.id,
    service: document.getElementById("bookingService").value,
    message: document.getElementById("bookingMessage").value,
    booking_date: document.getElementById("bookingDate").value,
    booking_time: document.getElementById("bookingTime").value,
    location: document.getElementById("bookingLocation").value,
    notes: document.getElementById("bookingNotes").value
  };

  try {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify(booking)
    });

    const data = await response.json();

    if (!response.ok) {
      showResponseModal(data.error || "Booking failed", "error");
      return;
    }

    showResponseModal(`Booking #${data.bookingId} submitted! Status: ${data.status}`, "success");
    closeModal();
    loadBookings();
  } catch (error) {
    showResponseModal("Booking failed: " + error.message, "error");
  }
});

async function loadBookings() {
  try {
    const response = await fetch("/api/bookings", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    const bookings = await response.json();
    renderBookings(bookings);
  } catch (error) {
    console.error("Failed to load bookings", error);
    document.getElementById("bookingsList").innerHTML = "<p>Failed to load bookings</p>";
  }
}

function renderBookings(bookings) {
  const container = document.getElementById("bookingsList");

  if (bookings.length === 0) {
    container.innerHTML = "<p style='grid-column: 1/-1; text-align: center; padding: 40px;'>No bookings yet.</p>";
    return;
  }

  container.innerHTML = bookings.map(b => `
    <div class="booking-card">
      <h3>${currentUser.role === "customer" ? b.profession : b.customer_name}</h3>
      <div class="booking-meta">📅 ${b.booking_date || 'No date specified'} ${b.booking_time || ''}</div>
      <div class="booking-meta">📍 ${b.location}</div>
      <div class="booking-meta">🔧 ${b.service}</div>
      ${b.message ? `<div class="booking-meta">💬 ${b.message}</div>` : ""}
      ${b.notes ? `<div class="booking-meta">📝 ${b.notes}</div>` : ""}
      <span class="booking-status ${b.status.toLowerCase()}">${b.status}</span>
      ${currentUser.role === "artisan" && b.status === "Pending" ? `
        <div class="booking-actions">
          <button class="btn btn-primary" onclick="updateBookingStatus(${b.id}, 'Accepted')">Accept</button>
          <button class="btn btn-outline" onclick="updateBookingStatus(${b.id}, 'Declined')">Decline</button>
        </div>
      ` : ""}
      ${currentUser.role === "artisan" && b.status === "Accepted" ? `
        <div class="booking-actions">
          <button class="btn btn-primary" onclick="updateBookingStatus(${b.id}, 'Completed')">Mark Completed</button>
        </div>
      ` : ""}
      ${currentUser.role === "customer" && b.status === "Completed" && b.existing_rating ? `
        <div class="review-block">
          <p class="review-given-label">Your rating:</p>
          <span class="review-stars">${'★'.repeat(b.existing_rating)}${'☆'.repeat(5 - b.existing_rating)}</span>
          ${b.existing_comment ? `<p class="review-comment">"${b.existing_comment}"</p>` : ""}
        </div>
      ` : ""}
      ${currentUser.role === "customer" && b.status === "Completed" && !b.existing_rating ? `
        <div class="review-block">
          <p class="review-given-label">Rate this artisan:</p>
          <div class="star-picker" id="starPicker-${b.id}">
            ${[1,2,3,4,5].map(n => `<span class="star-pick" data-value="${n}" onclick="setRating(${b.id}, ${n})">☆</span>`).join("")}
          </div>
          <textarea id="reviewComment-${b.id}" rows="2" placeholder="Optional comment"></textarea>
          <button class="btn btn-primary" style="margin-top:8px;" onclick="submitReview(${b.id})">Submit Review</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function setRating(bookingId, value) {
  pendingRatings[bookingId] = value;
  const picker = document.getElementById(`starPicker-${bookingId}`);
  picker.querySelectorAll(".star-pick").forEach(star => {
    const starValue = parseInt(star.dataset.value);
    star.textContent = starValue <= value ? "★" : "☆";
    star.classList.toggle("filled", starValue <= value);
  });
}

async function submitReview(bookingId) {
  const rating = pendingRatings[bookingId];
  if (!rating) {
    showResponseModal("Please select a star rating first", "error");
    return;
  }
  const comment = document.getElementById(`reviewComment-${bookingId}`).value;

  try {
    const response = await fetch(`/api/bookings/${bookingId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ rating, comment })
    });
    const data = await response.json();
    if (!response.ok) {
      showResponseModal(data.error || "Failed to submit review", "error");
      return;
    }
    delete pendingRatings[bookingId];
    showResponseModal("Review submitted, thank you!", "success");
    loadBookings();
  } catch (error) {
    showResponseModal("Failed to submit review: " + error.message, "error");
  }
}

async function updateBookingStatus(bookingId, status) {
  try {
    const response = await fetch(`/api/bookings/${bookingId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ status })
    });
    const data = await response.json();
    if (!response.ok) {
      showResponseModal(data.error || "Update failed", "error");
      return;
    }
    showResponseModal(`Booking marked ${status}`, "success");
    loadBookings();
  } catch (error) {
    showResponseModal("Update failed: " + error.message, "error");
  }
}

window.onclick = (event) => {
  const modal = document.getElementById("bookingModal");
  if (event.target === modal) {
    closeModal();
  }
  const respModal = document.getElementById("responseModal");
  if (event.target === respModal) {
    closeResponseModal();
  }
};
