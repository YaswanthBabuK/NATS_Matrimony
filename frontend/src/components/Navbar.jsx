import { NavLink } from "react-router-dom";
import { Menu, Phone, Sparkles, Star, Heart } from "lucide-react";

/* ─────────────────────────────────────────────────────────────────────────────
   NATS Site Header — 4-tier layout matching nats.org
   ─────────────────────────────────────────────────────────────────────────── */

/* Mango-leaf torana rendered as CSS shapes */
function Torana() {
  return (
    <div className="nats-torana" aria-hidden="true">
      <div className="torana-rope" />
      <div className="torana-leaves-row">
        {Array.from({ length: 32 }).map((_, i) => {
          const variant = i % 4;
          const heightMap = [44, 36, 28, 36];
          const h = heightMap[variant];
          return (
            <div key={i} className="torana-leaf-wrap">
              <div className="torana-knot" />
              <div className="torana-leaf" style={{ height: h }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const DEITY_COLORS = ["#FF6B35", "#E8941A", "#C62828", "#6A1B9A", "#1565C0"];

function DeityCircles() {
  return (
    <div className="deity-grid">
      {DEITY_COLORS.map((color, i) => (
        <div key={i} className="deity-circle" style={{ background: color }}>
          <span className="deity-icon"><Star size={16} color="#fff" fill="#fff" /></span>
        </div>
      ))}
    </div>
  );
}

function NatsSeal() {
  return (
    <div className="nats-seal-wrap">
      <div className="nats-seal">
        <div className="seal-arc-top">North America Telugu Society</div>
        <div className="seal-center">
          <div className="seal-nats-text">NATS</div>
          <div className="seal-te-text">ఉ.అ.తె.స</div>
        </div>
        <div className="seal-arc-bottom">ఉత్తర అమెరికా తెలుగు సంఘం</div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function Navbar() {
  return (
    <header className="nats-site-header">

      {/* ── TIER 1 · Top utility bar (amber/gold) ──────────────────────────── */}
      <div className="nats-topbar">
        <div className="topbar-inner">
          <div className="topbar-left">
            <span className="topbar-hamburger"><Menu size={18} /></span>
            <span className="topbar-brand">NATS Global</span>
          </div>

          <div className="topbar-center">
            <span className="topbar-phone-icon"><Phone size={16} /></span>
            <span className="topbar-helptext">
              Help Line:&nbsp;
              <strong>+1-888-4-TELUGU (+1-888-483-5848)</strong>
            </span>
          </div>

          <div className="topbar-right">
            <div className="sambaralu-wrap">
              <span className="sambaralu-icon"><Sparkles size={16} /></span>
              <div className="sambaralu-text">
                <span>America Telugu Sambaralu</span>
                <span className="sambaralu-te">అమెరికా తెలుగు సంబరాలు</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIER 2 · Site banner (deep red) ────────────────────────────────── */}
      <div className="nats-banner">
        <div className="banner-drape banner-drape-left" aria-hidden="true" />
        <div className="banner-content">
          <NatsSeal />
          <div className="banner-titles">
            <h1 className="banner-title-en">NORTH AMERICA TELUGU SOCIETY</h1>
            <h2 className="banner-title-te">ఉత్తర అమెరికా తెలుగు సంఘం</h2>
            <p className="banner-taxid">Tax ID: 26-4194139</p>
          </div>
          <DeityCircles />
        </div>
        <div className="banner-drape banner-drape-right" aria-hidden="true" />
      </div>

      {/* ── TIER 3 · Main navigation (white) ───────────────────────────────── */}
      <nav className="nats-mainnav">
        <div className="mainnav-inner">
          <ul className="mainnav-links">
            <li><NavLink to="/" end>HOME</NavLink></li>
            <li><a href="#who">WHO WE ARE</a></li>
            <li><a href="#what">WHAT WE DO</a></li>
            <li><a href="#involved">GET INVOLVED</a></li>
            <li><a href="#help">GET HELP</a></li>
            <li><a href="#media">MEDIA</a></li>
            <li><a href="#contact">CONTACT US</a></li>
            <li className="mainnav-matrimony">
              <NavLink to="/matrimony" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Heart size={14} /> MATRIMONY</NavLink>
            </li>
            <li><a href="#login">LOGIN</a></li>
          </ul>
        </div>
      </nav>

      {/* ── TIER 4 · Mango leaf torana ─────────────────────────────────────── */}
      <Torana />
    </header>
  );
}
