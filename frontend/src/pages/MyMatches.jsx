import { useEffect, useState } from "react";
import SubNav from "../components/SubNav";
import ProfileCard from "../components/ProfileCard";
import {
  getInterestsSent, getInterestsReceived,
  getWishlist, unmatchInterest,
} from "../data/api";

export default function MyMatches() {
  const [matches, setMatches]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [wishlistMap, setWishlistMap]   = useState({});
  const [interestMap, setInterestMap]   = useState({});
  // profileId → interestId  (needed to call unmatch)
  const [interestIdMap, setInterestIdMap] = useState({});
  const [unmatchingId, setUnmatchingId] = useState(null); // profileId currently being unmatched

  const currentId = sessionStorage.getItem("currentProfileId");

  const load = async () => {
    if (!currentId) return;
    setLoading(true);
    try {
      const [sent, received, sl] = await Promise.all([
        getInterestsSent(currentId),
        getInterestsReceived(currentId),
        getWishlist(currentId),
      ]);

      const seen      = new Set();
      const accepted  = [];
      const iMap      = {};   // profileId → status
      const idMap     = {};   // profileId → interestId

      // Interests I sent that the other person accepted
      for (const i of sent) {
        if (i.status === "accepted" && i.receiver) {
          const id = String(i.receiver_profile_id);
          if (!seen.has(id)) {
            seen.add(id);
            accepted.push(i.receiver);
            iMap[id]  = "accepted";
            idMap[id] = String(i.interest_id);
          }
        }
      }

      // Interests sent to me that I accepted
      for (const i of received) {
        if (i.status === "accepted" && i.sender) {
          const id = String(i.sender_profile_id);
          if (!seen.has(id)) {
            seen.add(id);
            accepted.push(i.sender);
            iMap[id]  = "accepted";
            idMap[id] = String(i.interest_id);
          }
        }
      }

      setMatches(accepted.filter((p) => p.age >= 18));
      setInterestMap(iMap);
      setInterestIdMap(idMap);

      const slMap = {};
      sl.forEach((e) => { slMap[String(e.saved_profile_id)] = e.wishlist_id; });
      setWishlistMap(slMap);

    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("profileSwitched", load);
    return () => window.removeEventListener("profileSwitched", load);
  }, []);

  const handleWishlistChange = (profileId, wishlistId) => {
    setWishlistMap((prev) => ({ ...prev, [String(profileId)]: wishlistId }));
  };

  const handleUnmatch = async (profileId) => {
    const interestId = interestIdMap[String(profileId)];
    if (!interestId) return;

    const confirmed = window.confirm(
      "Are you sure you want to unmatch? This will remove the connection for both of you."
    );
    if (!confirmed) return;

    setUnmatchingId(profileId);
    try {
      await unmatchInterest(interestId);
      // Remove instantly from UI without a full reload
      setMatches((prev) => prev.filter((p) => String(p.profile_id) !== String(profileId)));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to unmatch. Please try again.");
    } finally {
      setUnmatchingId(null);
    }
  };

  return (
    <>
      <SubNav />
      <div className="matches-banner">
        <h2>💑 My Matches</h2>
        <p>Profiles where interest has been mutually accepted</p>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="loading">Loading your matches…</div>
        ) : matches.length === 0 ? (
          <div className="empty-msg">
            No accepted matches yet. Browse profiles and send interests — when someone
            accepts your interest (or you accept theirs), they'll appear here.
          </div>
        ) : (
          <div className="profile-grid">
            {matches.map((p) => (
              <div key={p.profile_id} className="match-card-wrap">
                <ProfileCard
                  profile={p}
                  wishlistId={wishlistMap[String(p.profile_id)] || null}
                  onWishlistChange={handleWishlistChange}
                  interestStatus="accepted"
                  onSendInterest={() => {}}
                />
                <button
                  className="unmatch-btn"
                  onClick={() => handleUnmatch(p.profile_id)}
                  disabled={unmatchingId === p.profile_id}
                >
                  {unmatchingId === p.profile_id ? "Removing…" : "✕ Unmatch"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
