import { useNavigate } from "react-router-dom";
import { Heart, MapPin, CheckCircle, Clock, XCircle, Mail } from "lucide-react";
import { addWishlist, removeWishlist, resolvePhotoUrl } from "../data/api";

const maritalColor = {
  "Never Married":    "pill-green",
  Divorced:           "pill-blue",
  Widowed:            "pill-grey",
  "Awaiting Divorce": "pill-grey",
};

/**
 * Props:
 *   profile          — profile object from API
 *   matchScore       — optional number (shown as gold badge)
 *   wishlistId      — wishlist_id if already wishlisted, else null
 *   onWishlistChange(profileId, wishlistId|null) — callback
 *   interestStatus   — null | 'pending' | 'accepted' | 'rejected'
 *   onSendInterest(profileId) — callback to trigger interest from parent
 */
export default function ProfileCard({
  profile,
  matchScore,
  wishlistId,
  onWishlistChange,
  interestStatus = null,
  onSendInterest,
}) {
  const navigate  = useNavigate();
  const currentId = sessionStorage.getItem("currentProfileId");
  const isSelf    = String(profile.profile_id) === currentId;

  // ── Wishlist toggle ───────────────────────────────────────────────────────
  const handleWishlist = async (e) => {
    e.stopPropagation();
    try {
      if (wishlistId) {
        await removeWishlist(wishlistId);
        onWishlistChange?.(profile.profile_id, null);
      } else {
        const res = await addWishlist(currentId, profile.profile_id);
        onWishlistChange?.(profile.profile_id, res.wishlist_id);
      }
    } catch (err) {
      if (err.response?.status === 409) return; // already wishlisted — silently ignore
    }
  };

  // ── Interest button ────────────────────────────────────────────────────────
  const handleSendInterest = (e) => {
    e.stopPropagation();
    onSendInterest?.(profile.profile_id);
  };

  const interestBtn = () => {
    if (isSelf) return null;
    if (interestStatus === "accepted") {
      return (
        <button className="card-interest-btn card-interest-accepted" disabled style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <CheckCircle size={14} /> Accepted
        </button>
      );
    }
    if (interestStatus === "pending") {
      return (
        <button className="card-interest-btn card-interest-pending" disabled style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Clock size={14} /> Pending
        </button>
      );
    }
    if (interestStatus === "rejected") {
      return (
        <button className="card-interest-btn card-interest-rejected" disabled style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <XCircle size={14} /> Declined
        </button>
      );
    }
    // null — no interest sent yet
    return (
      <button
        className="card-interest-btn card-interest-send"
        onClick={handleSendInterest}
        style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <Mail size={14} /> Send Interest
      </button>
    );
  };

  const photoSrc = resolvePhotoUrl(profile.profile_photo_url);

  return (
    <div className="profile-card" onClick={() => navigate(`/matrimony/profile/${profile.profile_id}`)}>

      {/* Photo */}
      <div className={`card-photo-wrap${photoSrc ? "" : " card-no-photo"}`}>
        {photoSrc && (
          <img
            className="card-photo"
            src={photoSrc}
            alt={profile.full_name}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
        )}
        {matchScore !== undefined && (
          <span className="match-badge">{matchScore}% Match</span>
        )}
        {!isSelf && (
          <button
            className={`wishlist-icon${wishlistId ? " active" : ""}`}
            onClick={handleWishlist}
            title={wishlistId ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Heart size={16} fill={wishlistId ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="card-body">
        <div className="card-name">{profile.full_name}</div>

        {/* Age · Height */}
        <div className="card-meta">
          {profile.age} yrs · {profile.gender} · {profile.height || "—"}
        </div>

        {/* Religion / Caste */}
        {(profile.religion || profile.caste) && (
          <div className="card-meta" style={{ color: "#555" }}>
            {[profile.religion, profile.caste].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* Education · Profession */}
        {(profile.education || profile.profession) && (
          <div className="card-meta">
            {[profile.education, profile.profession].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* Location */}
        <div className="card-location" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {profile.current_city}, {profile.current_state}</div>

        {profile.native_place && (
          <div className="card-native">From: {profile.native_place}</div>
        )}

        {/* Marital status pill */}
        {profile.marital_status && (
          <div className="card-pills" style={{ marginTop: 8 }}>
            <span className={`pill ${maritalColor[profile.marital_status] || "pill-grey"}`}>
              {profile.marital_status}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="card-footer" onClick={(e) => e.stopPropagation()}>
        <span className="card-created-by">By: {profile.profile_created_by || "—"}</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {interestBtn()}
          <button
            className="btn btn-primary btn-sm"
            onClick={(e) => { e.stopPropagation(); navigate(`/matrimony/profile/${profile.profile_id}`); }}
          >
            View
          </button>
        </div>
      </div>
    </div>
  );
}
