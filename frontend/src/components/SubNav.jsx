import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import NotificationBell from "./NotificationBell";

export default function SubNav() {
  const navigate = useNavigate();

  const [userName, setUserName] = useState(
    () => sessionStorage.getItem("currentProfileName") || ""
  );
  const profileId = sessionStorage.getItem("currentProfileId");

  // Keep name in sync if another tab logs in/out
  useEffect(() => {
    const sync = () => setUserName(sessionStorage.getItem("currentProfileName") || "");
    window.addEventListener("authChanged", sync);
    window.addEventListener("storage",     sync);
    return () => {
      window.removeEventListener("authChanged", sync);
      window.removeEventListener("storage",     sync);
    };
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("currentProfileId");
    sessionStorage.removeItem("currentProfileName");
    sessionStorage.removeItem("currentProfileEmail");
    window.dispatchEvent(new Event("authChanged"));
    navigate("/login");
  };

  return (
    <div className="subnav">
      {/* ── Left: page tabs ─────────────────────────────────────────────── */}
      <div className="subnav-links">
        <NavLink to="/matrimony" end className={({ isActive }) => isActive ? "active" : ""}>
          Browse
        </NavLink>
        <NavLink to="/matrimony/matches" className={({ isActive }) => isActive ? "active" : ""}>
          My Matches
        </NavLink>
        <NavLink to="/matrimony/interests" className={({ isActive }) => isActive ? "active" : ""}>
          Interests
        </NavLink>
        <NavLink to="/matrimony/wishlist" className={({ isActive }) => isActive ? "active" : ""}>
          Wishlist
        </NavLink>
        <NavLink to="/matrimony/my-profile" className={({ isActive }) => isActive ? "active" : ""}>
          My Profile
        </NavLink>
      </div>

      {/* ── Right: bell + user + logout ─────────────────────────────────── */}
      <div className="subnav-right">
        {profileId && <NotificationBell profileId={profileId} />}
        {userName && (
          <span className="subnav-user">👤 {userName}</span>
        )}
        <button className="subnav-logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </div>
  );
}
