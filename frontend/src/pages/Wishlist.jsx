import { useEffect, useState } from "react";
import SubNav from "../components/SubNav";
import ProfileCard from "../components/ProfileCard";
import { getWishlist, removeWishlist } from "../data/api";

export default function Wishlist() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentId = sessionStorage.getItem("currentProfileId");

  const load = async () => {
    if (!currentId) return;
    setLoading(true);
    try {
      const data = await getWishlist(currentId);
      setEntries(data.filter((e) => e.saved_profile && e.saved_profile.age >= 18));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("profileSwitched", load);
    return () => window.removeEventListener("profileSwitched", load);
  }, []);

  const handleRemove = async (wishlistId) => {
    try {
      await removeWishlist(wishlistId);
      setEntries((prev) => prev.filter((e) => e.wishlist_id !== wishlistId));
    } catch {
      alert("Failed to remove from wishlist.");
    }
  };

  const handleWishlistChange = (profileId, newWishlistId) => {
    if (!newWishlistId) {
      setEntries((prev) => prev.filter((e) => String(e.saved_profile_id) !== String(profileId)));
    }
  };

  return (
    <>
      <SubNav />
      <div className="page-banner">
        <h1>My Wishlist</h1>
        <p>Profiles you've saved for later</p>
      </div>
      <div className="page-content">
        {loading ? (
          <div className="loading">Loading wishlist...</div>
        ) : entries.length === 0 ? (
          <div className="empty-msg">Your wishlist is empty. Browse profiles and save profiles to view them here.</div>
        ) : (
          <div className="profile-grid">
            {entries.map((entry) => (
              <div key={entry.wishlist_id} style={{ position: "relative" }}>
                <ProfileCard
                  profile={entry.saved_profile}
                  wishlistId={entry.wishlist_id}
                  onWishlistChange={handleWishlistChange}
                />
                <button
                  className="btn btn-danger btn-sm"
                  style={{ position: "absolute", bottom: 54, right: 12 }}
                  onClick={() => handleRemove(entry.wishlist_id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
