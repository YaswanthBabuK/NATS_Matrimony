import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { IconHeart, IconLogOut, IconUser, IconUsers, IconInbox, IconBookHeart, IconLock, IconBell, IconChevronDown } from "../icons";
import natsLogo from "../assets/NATS-logo.png";

const NATS = "https://www.natsworld.org/Content/User/images/";

/* ── Left logo ────────────────────────────────────────────────────────────── */
function NatsSeal() {
  return (
    <div className="nats-seal-wrap">
      <img src={natsLogo} alt="NATS" className="nats-logo-img" />
    </div>
  );
}

/* ── Center banner text ─────────────────────────────────────────────────── */
function BannerText() {
  return (
    <div className="banner-logotext-wrap">
      <div className="banner-titles">
        <h1 className="banner-title-en">NORTH AMERICA TELUGU SOCIETY</h1>
        <h2 className="banner-title-te">NATS Matrimony — వివాహ వేదిక</h2>
        <p className="banner-taxid">Connecting Telugu families across North America</p>
      </div>
    </div>
  );
}

/* ── Right: Sign In / User pill ──────────────────────────────────────────── */
function BannerAuth({ profileId, profileName, onLogout, navigate }) {
  const [open, setOpen] = useState(false);
  const initial = profileName ? profileName.charAt(0).toUpperCase() : "U";

  if (profileId) {
    return (
      <div className="banner-auth">
        {/* Bell icon */}
        <button className="banner-bell-btn" aria-label="Notifications">
          <IconBell size={20} color="#fff" />
        </button>

        {/* User pill */}
        <div className="banner-user-pill" onClick={() => setOpen(o => !o)}>
          <span className="banner-user-avatar">{initial}</span>
          <span className="banner-user-name">{profileName}</span>
          <IconChevronDown size={14} color="#fff" />

          {open && (
            <div className="banner-dropdown">
              <NavLink to="/matrimony/my-profile" className="banner-dd-item" onClick={() => setOpen(false)}>
                <IconUser size={14} /> My Profile
              </NavLink>
              <button className="banner-dd-item banner-dd-logout" onClick={onLogout}>
                <IconLogOut size={14} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="banner-auth">
      <button className="banner-signin-btn" onClick={() => navigate("/login")}>
        <IconLock size={15} /> Sign In
      </button>
    </div>
  );
}

/* ── Torana ─────────────────────────────────────────────────────────────── */
function Torana() {
  return <div className="nats-torana" aria-hidden="true" />;
}

/* ── Matrimony sub-nav ───────────────────────────────────────────────────── */
function MatrimonySubnav() {
  return (
    <nav className="matrimony-subnav">
      <div className="subnav-inner">
        <div className="subnav-links">
          <NavLink to="/matrimony" end className={({ isActive }) => isActive ? "subnav-link subnav-link--active" : "subnav-link"}>
            <IconUsers size={14} /> Browse Profiles
          </NavLink>
          <NavLink to="/matrimony/matches" className={({ isActive }) => isActive ? "subnav-link subnav-link--active" : "subnav-link"}>
            <IconHeart size={14} /> My Matches
          </NavLink>
          <NavLink to="/matrimony/interests" className={({ isActive }) => isActive ? "subnav-link subnav-link--active" : "subnav-link"}>
            <IconInbox size={14} /> My Interests
          </NavLink>
          <NavLink to="/matrimony/wishlist" className={({ isActive }) => isActive ? "subnav-link subnav-link--active" : "subnav-link"}>
            <IconBookHeart size={14} /> Wishlist
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

/* ── Main Navbar ─────────────────────────────────────────────────────────── */
export default function Navbar() {
  const navigate  = useNavigate();
  const location  = useLocation();

  const [profileId,   setProfileId]   = useState(() => sessionStorage.getItem("currentProfileId"));
  const [profileName, setProfileName] = useState(() => sessionStorage.getItem("currentProfileName") || "My Profile");

  useEffect(() => {
    const sync = () => {
      setProfileId(sessionStorage.getItem("currentProfileId"));
      setProfileName(sessionStorage.getItem("currentProfileName") || "My Profile");
    };
    window.addEventListener("authChanged", sync);
    return () => window.removeEventListener("authChanged", sync);
  }, []);

  const handleLogout = () => {
    sessionStorage.clear();
    window.dispatchEvent(new Event("authChanged"));
    navigate("/login");
  };

  const onMatrimonyPage = location.pathname.startsWith("/matrimony");
  const showSubnav      = profileId && onMatrimonyPage;

  return (
    <>
      <header className="nats-site-header">

        {/* ══ BANNER — red gradient with logo + title + auth buttons ═══════ */}
        <div className="nats-banner">
          <div className="banner-content">
            <NatsSeal />
            <BannerText />
            <BannerAuth
              profileId={profileId}
              profileName={profileName}
              onLogout={handleLogout}
              navigate={navigate}
            />
          </div>
        </div>

        {/* ══ TORANA ════════════════════════════════════════════════════════ */}
        <Torana />

      </header>

      {/* ══ MATRIMONY SUB-NAV — outside header so sticky works on scroll ══ */}
      {showSubnav && <MatrimonySubnav />}
    </>
  );
}
