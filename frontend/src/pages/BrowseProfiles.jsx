import { useEffect, useRef, useState } from "react";
import FilterBar from "../components/FilterBar";
import ProfileCard from "../components/ProfileCard";
import SubNav from "../components/SubNav";
import { getProfiles, getProfile, getWishlist, getInterestsSent, sendInterest } from "../data/api";

export default function BrowseProfiles() {
  const [profiles, setProfiles]       = useState([]);
  const [filters, setFilters]         = useState({});
  const [prefFilters, setPrefFilters] = useState({});
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [wishlistMap, setWishlistMap] = useState({});
  const [interestMap, setInterestMap] = useState({});

  const currentId = sessionStorage.getItem("currentProfileId");
  const viewerRef = useRef(null); // kept for future use; viewer_id sent via getProfiles

  // ── Fetch profiles from backend (sorting happens server-side via sort_by param) ──
  const fetchProfiles = async (f = filters, p = page) => {
    setLoading(true);
    try {
      const data = await getProfiles(f, p);
      setProfiles(data);
    } catch {
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupportData = async () => {
    if (!currentId) return;
    try {
      const [sl, sent] = await Promise.all([
        getWishlist(currentId),
        getInterestsSent(currentId),
      ]);
      const slMap = {};
      sl.forEach((e) => { slMap[String(e.saved_profile_id)] = e.wishlist_id; });
      setWishlistMap(slMap);

      const iMap = {};
      sent.forEach((i) => { iMap[String(i.receiver_profile_id)] = i.status; });
      setInterestMap(iMap);
    } catch {}
  };

  // ── On mount: load viewer profile + preferences, then fetch ───────────────
  useEffect(() => {
    const init = async () => {
      let initial = {};
      if (currentId) {
        try {
          const profile = await getProfile(currentId, currentId);
          viewerRef.current = profile;

          // Preferences are used by the backend for match-score ranking only.
          // We intentionally do NOT send them as hard API filter params here —
          // doing so turns soft preferences into strict WHERE clauses that can
          // reduce results to 0-1 profiles (reproducible for female seed accounts
          // whose pref_education + pref_profession + pref_location + age_max all
          // match only one male seed profile simultaneously).
        } catch { /* no preferences — browse without pre-filters */ }
      }
      setPrefFilters(initial);
      setFilters(initial);
      fetchProfiles(initial, 1);
      fetchSupportData();
    };

    init();
    const onSwitch = () => init();
    window.addEventListener("profileSwitched", onSwitch);
    return () => window.removeEventListener("profileSwitched", onSwitch);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSearch = (f) => {
    // Reset → restore preference-based filters, not blank
    const active = Object.keys(f).length === 0 ? prefFilters : f;
    setFilters(active);
    setPage(1);
    fetchProfiles(active, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchProfiles(filters, newPage);
  };

  const handleWishlistChange = (profileId, wishlistId) => {
    setWishlistMap((prev) => ({ ...prev, [String(profileId)]: wishlistId }));
  };

  const handleSendInterest = async (receiverId) => {
    if (!currentId) return;
    try {
      await sendInterest(currentId, receiverId);
      setInterestMap((prev) => ({ ...prev, [String(receiverId)]: "pending" }));
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to send interest.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <SubNav />
      <div className="page-banner">
        <h1>NATS Matrimony</h1>
        <p>వివాహ వేదిక — Find Your Life Partner</p>
      </div>

      <FilterBar onSearch={handleSearch} initialFilters={prefFilters} />

      <div className="page-content">
        {loading ? (
          <div className="loading">Loading profiles…</div>
        ) : profiles.length === 0 ? (
          <div className="empty-msg">No profiles available at the moment. Check back soon!</div>
        ) : (
          <div className="profile-grid">
            {profiles.map((p) => (
              <ProfileCard
                key={p.profile_id}
                profile={p}
                wishlistId={wishlistMap[String(p.profile_id)] || null}
                onWishlistChange={handleWishlistChange}
                interestStatus={interestMap[String(p.profile_id)] || null}
                onSendInterest={handleSendInterest}
              />
            ))}
          </div>
        )}

        <div className="pagination">
          <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}>← Prev</button>
          <span>Page {page}</span>
          <button onClick={() => handlePageChange(page + 1)} disabled={profiles.length < 20}>Next →</button>
        </div>
      </div>
    </>
  );
}
