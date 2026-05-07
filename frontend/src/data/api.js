import axios from "axios";

// In production (Vercel) VITE_API_URL = "https://nats-matrimony.onrender.com"
// In development the env var is unset so we fall back to "" (Vite proxy handles /api)
export const API_ORIGIN = import.meta.env.VITE_API_URL || "";
const BASE_URL = `${API_ORIGIN}/api`;

const api = axios.create({ baseURL: BASE_URL });

/**
 * Resolve a profile photo URL coming from the backend.
 *  - Absolute URLs (http/https) — e.g. randomuser.me — returned as-is.
 *  - Server-relative paths like "/uploads/profiles/<id>.jpg" get prefixed
 *    with the backend origin so the browser can load them.
 *  - Falsy values return null (caller decides on placeholder).
 */
export function resolvePhotoUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${API_ORIGIN}${url}`;
  return url;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login — returns { profile_id, full_name, email } on success,
 * throws with err.response.data.detail on failure (401 Invalid email or password).
 */
export const login = (email, password) =>
  api.post("/auth/login", { email, password }).then((r) => r.data);

/**
 * POST /api/auth/register — multipart/form-data
 * `formData` must be a FormData object with:
 *   - "data"  : JSON string of all profile fields
 *   - "photo" : File (optional)
 */
export const register = (formData) =>
  api.post("/auth/register", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

/** Returns { available: true } if email is free, { available: false } if already taken. */
export const checkEmail = (email) =>
  api.get("/auth/check-email", { params: { email } }).then((r) => r.data);

/**
 * Called after Firebase Auth succeeds — no password needed.
 * Returns { profile_id, full_name, email } or throws 404 if no profile exists.
 */
export const getProfileByEmail = (email) =>
  api.get("/auth/profile-by-email", { params: { email } }).then((r) => r.data);


// ─── Profiles ────────────────────────────────────────────────────────────────

/**
 * Browse profiles.
 * viewer_id is injected automatically from sessionStorage so the backend can
 * (a) filter to opposite gender by default, (b) exclude the viewer's own card.
 */
export const getProfiles = (filters = {}, page = 1) => {
  const viewerId = sessionStorage.getItem("currentProfileId");
  const params = { ...filters, page, limit: 20 };
  if (viewerId && !filters.viewer_id) params.viewer_id = viewerId;
  return api.get("/profiles", { params }).then((r) => r.data);
};

/**
 * Fetch all profiles without viewer_id injection (used by the testing switcher).
 * Fetches males + females separately so gender filtering is bypassed entirely.
 */
export const getAllProfilesForTesting = () =>
  Promise.all([
    api.get("/profiles", { params: { gender: "Male",   limit: 50, page: 1 } }),
    api.get("/profiles", { params: { gender: "Female", limit: 50, page: 1 } }),
  ]).then(([males, females]) => ({ males: males.data, females: females.data }));

export const getProfile = (id, viewerId = null) => {
  // viewerId replaces the old contact_revealed boolean flag.
  // The backend verifies the interest record and decides whether to reveal contact.
  const params = {};
  if (viewerId) params.viewer_id = viewerId;
  return api.get(`/profiles/${id}`, { params }).then((r) => r.data);
};

export const createProfile = (data) =>
  api.post("/profiles", data).then((r) => r.data);

export const updateProfile = (id, data) =>
  api.put(`/profiles/${id}`, data).then((r) => r.data);

/** PATCH /profiles/{id}/photo — multipart FormData with a "photo" file field. */
export const updateProfilePhoto = (id, formData) =>
  api.patch(`/profiles/${id}/photo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }).then((r) => r.data);

/** PATCH /profiles/{id}/visibility — toggles is_hidden on the backend. */
export const toggleVisibility = (id) =>
  api.patch(`/profiles/${id}/visibility`).then((r) => r.data);

/** DELETE /profiles/{id} — permanently deletes the account. */
export const deleteMyProfile = (id) => api.delete(`/profiles/${id}`);

/** PATCH /profiles/{id}/email-prefs — update email notification preferences. */
export const updateEmailPrefs = (id, prefs) =>
  api.patch(`/profiles/${id}/email-prefs`, null, { params: prefs }).then((r) => r.data);

export const reportProfile = (id) =>
  api.post(`/profiles/${id}/report`).then((r) => r.data);

// ─── Matches ─────────────────────────────────────────────────────────────────

export const getMatches = (profileId) =>
  api.get(`/matches/${profileId}`).then((r) => r.data);

// ─── Interests ───────────────────────────────────────────────────────────────

export const sendInterest = (senderId, receiverId) =>
  api
    .post("/interests", { sender_profile_id: senderId, receiver_profile_id: receiverId })
    .then((r) => r.data);

export const getInterestsSent = (profileId) =>
  api.get(`/interests/sent/${profileId}`).then((r) => r.data);

export const getInterestsReceived = (profileId) =>
  api.get(`/interests/received/${profileId}`).then((r) => r.data);

/**
 * Returns { sent_by_me, received_by_me, contact_revealed }.
 * Used by ProfileDetail to determine the exact button state + contact reveal
 * in ONE round-trip instead of fetching all sent + all received.
 */
export const getInterestBetween = (myId, theirId) =>
  api.get(`/interests/between/${myId}/${theirId}`).then((r) => r.data);

export const updateInterest = (interestId, status) =>
  api.put(`/interests/${interestId}`, { status }).then((r) => r.data);

/** DELETE /api/interests/{id} — removes the match record for both parties. */
export const unmatchInterest = (interestId) =>
  api.delete(`/interests/${interestId}`);

// ─── Wishlists ──────────────────────────────────────────────────────────────

export const getWishlist = (profileId) =>
  api.get(`/wishlists/${profileId}`).then((r) => r.data);

export const addWishlist = (profileId, savedProfileId) =>
  api
    .post("/wishlists", { profile_id: profileId, saved_profile_id: savedProfileId })
    .then((r) => r.data);

export const removeWishlist = (wishlistId) =>
  api.delete(`/wishlists/${wishlistId}`);

// ─── Notifications ───────────────────────────────────────────────────────────

/** GET /notifications/{profileId} — newest first, max 50 */
export const getNotifications = (profileId) =>
  api.get(`/notifications/${profileId}`).then((r) => r.data);

/** PATCH /notifications/{id}/read — mark one notification read */
export const markNotificationRead = (notificationId) =>
  api.patch(`/notifications/${notificationId}/read`).then((r) => r.data);

/** PATCH /notifications/read-all/{profileId} — mark all read */
export const markAllNotificationsRead = (profileId) =>
  api.patch(`/notifications/read-all/${profileId}`).then((r) => r.data);

export default api;
