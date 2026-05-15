import { NavLink } from "react-router-dom";
import natsLogo from "../assets/NATS-logo.png";

const QUICK_LINKS = [
  { label: "Home",           to: "/" },
  { label: "Browse Profiles",to: "/matrimony" },
  { label: "My Matches",     to: "/matrimony/matches" },
  { label: "My Interests",   to: "/matrimony/interests" },
  { label: "Wishlist",       to: "/matrimony/wishlist" },
  { label: "My Profile",     to: "/matrimony/my-profile" },
];

const NATS_GLOBAL = [
  { label: "NATS Home",    href: "https://www.natsworld.org/" },
  { label: "Who We Are",   href: "https://www.natsworld.org/p/about-us-natsglobal-new.html" },
  { label: "What We Do",   href: "https://www.natsworld.org/p/community-services.html" },
  { label: "Get Involved", href: "https://www.natsworld.org/p/sponsorship-options-new.html" },
  { label: "Get Help",     href: "https://www.natsworld.org/nats-helpline" },
  { label: "Media",        href: "https://www.natsworld.org/nats-global/news" },
];

function LinkItem({ item }) {
  if (item.to) {
    return (
      <li className="footer2-link-item">
        <NavLink to={item.to} className="footer2-link">
          <span className="footer2-arrow">›</span> {item.label}
        </NavLink>
      </li>
    );
  }
  return (
    <li className="footer2-link-item">
      <a href={item.href} target="_blank" rel="noreferrer" className="footer2-link">
        <span className="footer2-arrow">›</span> {item.label}
      </a>
    </li>
  );
}

export default function Footer() {
  return (
    <footer className="footer2">
      <div className="footer2-body">
        <div className="footer2-inner">

          {/* ── Col 1: Brand ───────────────────────────────────────────────── */}
          <div className="footer2-brand">
            <div className="footer2-logo-row">
              <img src={natsLogo} alt="NATS" className="footer2-logo-img" />
              <div className="footer2-brand-text">
                <span className="footer2-brand-name">NATS</span>
                <span className="footer2-brand-sub">Matrimony</span>
              </div>
            </div>
            <p className="footer2-brand-desc">
              Connecting Telugu families across North America to find meaningful, lifelong partnerships within the NATS community.
            </p>
            <div className="footer2-socials">
              <a href="https://www.facebook.com/NATSorg" target="_blank" rel="noreferrer" className="footer2-social footer2-social-fb" aria-label="Facebook">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
              </a>
              <a href="https://twitter.com/NATSorg" target="_blank" rel="noreferrer" className="footer2-social footer2-social-tw" aria-label="Twitter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>
                </svg>
              </a>
              <a href="https://www.youtube.com/NATSorg" target="_blank" rel="noreferrer" className="footer2-social footer2-social-yt" aria-label="YouTube">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                  <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/>
                </svg>
              </a>
            </div>
          </div>

          {/* ── Col 2: Quick Links ─────────────────────────────────────────── */}
          <div className="footer2-col">
            <h4 className="footer2-col-title">QUICK LINKS</h4>
            <ul className="footer2-link-list">
              {QUICK_LINKS.map(l => <LinkItem key={l.label} item={l} />)}
            </ul>
          </div>

          {/* ── Col 3: NATS Global ─────────────────────────────────────────── */}
          <div className="footer2-col">
            <h4 className="footer2-col-title">NATS GLOBAL</h4>
            <ul className="footer2-link-list">
              {NATS_GLOBAL.map(l => <LinkItem key={l.label} item={l} />)}
            </ul>
          </div>

          {/* ── Col 4: Contact ─────────────────────────────────────────────── */}
          <div className="footer2-col">
            <h4 className="footer2-col-title">CONTACT NATS</h4>
            <div className="footer2-contact-row">
              <svg className="footer2-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.77a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <div>
                <div className="footer2-contact-main">+1-888-4-TELUGU</div>
                <div className="footer2-contact-sub">(+1-888-483-5848)</div>
              </div>
            </div>
            <div className="footer2-contact-row">
              <svg className="footer2-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <a href="https://www.natsworld.org" target="_blank" rel="noreferrer" className="footer2-contact-link">
                www.natsworld.org
              </a>
            </div>
            <a
              href="https://www.natsworld.org/p/donate.html"
              target="_blank"
              rel="noreferrer"
              className="footer2-donate-btn"
            >
              DONATE NOW
            </a>
          </div>

        </div>
      </div>

      {/* ── Copyright ──────────────────────────────────────────────────────── */}
      <div className="footer2-copyright">
        © 2025 North America Telugu Society — NATS. All rights reserved.
      </div>
    </footer>
  );
}
