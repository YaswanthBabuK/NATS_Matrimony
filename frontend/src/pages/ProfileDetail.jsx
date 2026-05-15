import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { IconMail, IconClock, IconCheckCircle2, IconXCircle, IconHeart, IconCheckCircle, IconX } from "../icons";
import ContactReveal from "../components/ContactReveal";
import {
  getProfile,
  sendInterest,
  addWishlist,
  removeWishlist,
  getWishlist,
  getInterestBetween,
  updateInterest,
  reportProfile,
  resolvePhotoUrl,
} from "../data/api";

// ─── Interest state machine ───────────────────────────────────────────────────
//
//  null          → "Send Interest" button
//  sent_pending  → "⏳ Interest Pending"
//  sent_accepted → "✅ Mutual Match · Contact Unlocked"
//  sent_rejected → "❌ Interest Declined"
//  recv_pending  → "Accept / Decline" buttons (they sent to me)
//  recv_accepted → "✅ Mutual Match · Contact Unlocked"  (I already accepted theirs)
//  recv_rejected → (I rejected them — show nothing special)
//
// ─────────────────────────────────────────────────────────────────────────────

function deriveInterestState(between) {
  if (!between) return { uiState: null, interestId: null };

  const { sent_by_me, received_by_me } = between;

  if (sent_by_me) {
    return {
      uiState: `sent_${sent_by_me.status}`,   // sent_pending / sent_accepted / sent_rejected
      interestId: sent_by_me.interest_id,
    };
  }
  if (received_by_me) {
    return {
      uiState: `recv_${received_by_me.status}`,   // recv_pending / recv_accepted / recv_rejected
      interestId: received_by_me.interest_id,
    };
  }
  return { uiState: null, interestId: null };
}

export default function ProfileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentId = sessionStorage.getItem("currentProfileId");

  const [profile, setProfile]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [wishlistId, setWishlistId]     = useState(null);
  const [between, setBetween]             = useState(null);   // raw /between response
  const [msg, setMsg]                     = useState({ text: "", type: "info" });

  // ── Load everything ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch profile — backend adds contact info only if viewer has accepted interest
      const p = await getProfile(id, currentId || null);
      setProfile(p);

      if (currentId && String(id) !== currentId) {
        // 2. Single call to get bilateral interest state
        const btwn = await getInterestBetween(currentId, id);
        setBetween(btwn);

        // 3. Wishlist status
        const sl = await getWishlist(currentId);
        const entry = sl.find((e) => String(e.saved_profile_id) === id);
        setWishlistId(entry ? entry.wishlist_id : null);
      }
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [id, currentId]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const notify = (text, type = "info") => setMsg({ text, type });

  const handleSendInterest = async () => {
    try {
      await sendInterest(currentId, id);
      notify("Interest sent! Waiting for their response.", "success");
      const btwn = await getInterestBetween(currentId, id);
      setBetween(btwn);
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to send interest.", "error");
    }
  };

  const handleRespondToInterest = async (status) => {
    const { interestId } = deriveInterestState(between);
    if (!interestId) return;
    try {
      await updateInterest(interestId, status);
      notify(
        status === "accepted"
          ? "You accepted! Contact details are now unlocked."
          : "Interest declined.",
        status === "accepted" ? "success" : "info"
      );
      // Re-fetch profile (contact may now be revealed) + interest state
      const [p, btwn] = await Promise.all([
        getProfile(id, currentId),
        getInterestBetween(currentId, id),
      ]);
      setProfile(p);
      setBetween(btwn);
    } catch (err) {
      notify(err.response?.data?.detail || "Failed to update interest.", "error");
    }
  };

  const handleWishlist = async () => {
    try {
      if (wishlistId) {
        await removeWishlist(wishlistId);
        setWishlistId(null);
        notify("Removed from wishlist.", "info");
      } else {
        const res = await addWishlist(currentId, id);
        setWishlistId(res.wishlist_id);
        notify("Added to wishlist!", "success");
      }
    } catch (err) {
      notify(err.response?.data?.detail || "Action failed.", "error");
    }
  };

  const handleReport = async () => {
    if (!window.confirm("Report this profile to the NATS team?")) return;
    try {
      const res = await reportProfile(id);
      notify(res.message, "info");
    } catch {
      notify("Failed to report profile.", "error");
    }
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  if (loading) return <><div className="loading">Loading profile…</div></>;
  if (!profile) return <><div className="error-msg">Profile not found.</div></>;

  const isSelf    = String(profile.profile_id) === currentId;
  const pref      = profile.preference;
  const { uiState } = deriveInterestState(between);
  const contactRevealed = between?.contact_revealed || profile.contact_revealed || false;

  const msgColors = {
    success: { background: "#d4edda", color: "#155724", border: "#c3e6cb" },
    error:   { background: "#f8d7da", color: "#721c24", border: "#f5c6cb" },
    info:    { background: "#FEF3CD", color: "#856404", border: "#ffc107" },
  };

  return (
    <>
      {/* Back bar */}
      <div style={{ background: "#8B0000", padding: "10px 32px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: "none", border: "1px solid #fff", color: "#fff", padding: "5px 14px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}
        >
          ← Back
        </button>
      </div>

      {/* Flash message */}
      {msg.text && (
        <div style={{ padding: "10px 32px", fontSize: 14, borderBottom: `1px solid ${msgColors[msg.type].border}`, ...msgColors[msg.type] }}>
          {msg.text}
          <button onClick={() => setMsg({ text: "", type: "info" })} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "inherit" }}><IconX size={16} /></button>
        </div>
      )}

      <div className="profile-detail">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="detail-left">
          <img
            className="detail-photo"
            src={resolvePhotoUrl(profile.profile_photo_url) || "https://via.placeholder.com/300x320?text=No+Photo"}
            alt={profile.full_name}
          />

          {!isSelf && (
            <div className="detail-actions">

              {/* ── Interest button state machine ── */}
              {uiState === null && (
                <button className="btn btn-primary" onClick={handleSendInterest} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconMail size={14} /> Send Interest
                </button>
              )}

              {uiState === "sent_pending" && (
                <button className="btn btn-outline" disabled style={{ cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconClock size={14} /> Interest Pending
                </button>
              )}

              {uiState === "sent_accepted" && (
                <button className="btn btn-success" disabled style={{ cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconCheckCircle2 size={14} /> Mutual Match · Contact Unlocked
                </button>
              )}

              {uiState === "sent_rejected" && (
                <button className="btn btn-outline" disabled style={{ cursor: "default", opacity: 0.6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconXCircle size={14} /> Interest Declined
                </button>
              )}

              {/* They sent interest to me — show Accept / Decline */}
              {uiState === "recv_pending" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ background: "#FEF3CD", color: "#856404", padding: "8px 12px", borderRadius: 4, fontSize: 13, marginBottom: 4 }}>
                    This person sent you an interest
                  </div>
                  <button className="btn btn-success" onClick={() => handleRespondToInterest("accepted")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IconCheckCircle size={14} /> Accept Interest
                  </button>
                  <button className="btn btn-danger" onClick={() => handleRespondToInterest("rejected")} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IconX size={14} /> Decline Interest
                  </button>
                </div>
              )}

              {uiState === "recv_accepted" && (
                <button className="btn btn-success" disabled style={{ cursor: "default", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <IconCheckCircle2 size={14} /> Mutual Match · Contact Unlocked
                </button>
              )}

              {uiState === "recv_rejected" && (
                <button className="btn btn-outline" disabled style={{ cursor: "default", opacity: 0.6 }}>
                  Interest Declined
                </button>
              )}

              {/* Wishlist */}
              <button className="btn btn-outline" onClick={handleWishlist} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IconHeart size={14} filled={!!wishlistId} /> {wishlistId ? "Wishlisted" : "Add to Wishlist"}
              </button>

              {/* Report */}
              <button className="detail-report" onClick={handleReport}>
                Report Profile
              </button>
            </div>
          )}

          {/* Contact Reveal panel */}
          <div style={{ marginTop: 16 }}>
            <ContactReveal profile={profile} interestAccepted={contactRevealed} />
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="detail-right">

          {/* Mutual match banner */}
          {contactRevealed && (
            <div style={{ background: "linear-gradient(135deg,#27ae60,#1e8449)", color: "#fff", padding: "14px 20px", borderRadius: 8, marginBottom: 20, fontSize: 15, fontWeight: 600 }}>
              Congratulations! You are a Mutual Match. Contact details are now visible.
            </div>
          )}

          <div className="detail-section">
            <h3>Personal Details</h3>
            <div className="detail-grid">
              <div className="detail-item"><label>Full Name</label><span>{profile.full_name}</span></div>
              <div className="detail-item"><label>Age</label><span>{profile.age} years</span></div>
              <div className="detail-item"><label>Gender</label><span>{profile.gender}</span></div>
              <div className="detail-item"><label>Height</label><span>{profile.height || "—"}</span></div>
              <div className="detail-item"><label>Religion</label><span>{profile.religion || "—"}</span></div>
              <div className="detail-item"><label>Caste</label><span>{profile.caste || "—"}</span></div>
              <div className="detail-item"><label>Marital Status</label><span>{profile.marital_status || "—"}</span></div>
              <div className="detail-item"><label>Profile Created By</label><span>{profile.profile_created_by || "—"}</span></div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Professional Details</h3>
            <div className="detail-grid">
              <div className="detail-item"><label>Education</label><span>{profile.education || "—"}</span></div>
              <div className="detail-item"><label>Profession</label><span>{profile.profession || "—"}</span></div>
              <div className="detail-item"><label>Annual Income</label><span>{profile.annual_income || "—"}</span></div>
            </div>
          </div>

          <div className="detail-section">
            <h3>Location</h3>
            <div className="detail-grid">
              <div className="detail-item"><label>Current City</label><span>{profile.current_city || "—"}</span></div>
              <div className="detail-item"><label>State</label><span>{profile.current_state || "—"}</span></div>
              <div className="detail-item"><label>Native Place</label><span>{profile.native_place || "—"}</span></div>
            </div>
          </div>

          {profile.about_me && (
            <div className="detail-section">
              <h3>About Me</h3>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: "#444" }}>{profile.about_me}</p>
            </div>
          )}

          {pref && (
            <div className="detail-section">
              <h3>Partner Preferences</h3>
              <div className="detail-grid">
                <div className="detail-item"><label>Gender</label><span>{pref.pref_gender || "—"}</span></div>
                <div className="detail-item"><label>Age Range</label><span>{pref.pref_age_min} – {pref.pref_age_max} yrs</span></div>
                <div className="detail-item"><label>Education</label><span>{pref.pref_education || "Any"}</span></div>
                <div className="detail-item"><label>Profession</label><span>{pref.pref_profession || "Any"}</span></div>
                <div className="detail-item"><label>Preferred Location</label><span>{pref.pref_location || "Any"}</span></div>
                <div className="detail-item"><label>Marital Status Open To</label><span>{pref.pref_marital_statuses || "See defaults"}</span></div>
                <div className="detail-item"><label>Willing to Relocate</label><span>{pref.willing_to_relocate ? "Yes" : "No"}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
