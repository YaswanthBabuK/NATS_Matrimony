import { Mail } from "lucide-react";
import { NavLink } from "react-router-dom";

const QUICK_LINKS_LEFT = [
  { label: "Home",          to: "/" },
  { label: "Who We Are",    href: "https://www.nats.org/who-we-are" },
  { label: "What We Do",    href: "https://www.nats.org/what-we-do" },
  { label: "Get Involved",  href: "https://www.nats.org/get-involved" },
  { label: "Get Help",      href: "https://www.nats.org/get-help" },
];

const QUICK_LINKS_RIGHT = [
  { label: "Media",              href: "https://www.nats.org/media" },
  { label: "Information Center", href: "https://www.nats.org/information-center" },
  { label: "Blog",               href: "https://www.nats.org/blog" },
  { label: "Matrimony",          to: "/matrimony" },
  { label: "Contact Us",         href: "https://www.nats.org/contact-us" },
];

export default function Footer() {
  return (
    <footer className="nats-footer">

      {/* ── Main footer body ─────────────────────────────────────────────── */}
      <div className="footer-body">
        <div className="footer-inner">

          {/* NATS Logo card */}
          <div className="footer-logo-card">
            <div className="footer-seal">
              <div className="footer-seal-arc-top">North America Telugu Society</div>
              <div className="footer-seal-nats">NATS</div>
              <div className="footer-seal-te">ఉత్తర అమెరికా తెలుగు సంఘం</div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links-block">
            <h4 className="footer-links-title">Quick Links</h4>
            <div className="footer-links-cols">
              <ul className="footer-links-col">
                {QUICK_LINKS_LEFT.map((l) =>
                  l.to ? (
                    <li key={l.label}><NavLink to={l.to}>{l.label}</NavLink></li>
                  ) : (
                    <li key={l.label}><a href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>
                  )
                )}
              </ul>
              <ul className="footer-links-col">
                {QUICK_LINKS_RIGHT.map((l) =>
                  l.to ? (
                    <li key={l.label}><NavLink to={l.to}>{l.label}</NavLink></li>
                  ) : (
                    <li key={l.label}><a href={l.href} target="_blank" rel="noreferrer">{l.label}</a></li>
                  )
                )}
              </ul>
            </div>
          </div>

          {/* Subscribe + Social */}
          <div className="footer-subscribe-block">
            <div className="footer-subscribe-row">
              <Mail size={40} className="footer-mailbox-icon" />
              <a
                href="https://www.nats.org/subscribe"
                target="_blank"
                rel="noreferrer"
                className="footer-subscribe-btn"
              >
                SUBSCRIBE HERE
              </a>
            </div>

            <div className="footer-social-label">Connect With Us</div>
            <div className="footer-social-icons">
              <a href="https://www.facebook.com/NATSorg" target="_blank" rel="noreferrer" className="footer-social-icon footer-social-fb" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://twitter.com/NATSorg" target="_blank" rel="noreferrer" className="footer-social-icon footer-social-tw" aria-label="Twitter/X">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
              <a href="https://www.youtube.com/NATSorg" target="_blank" rel="noreferrer" className="footer-social-icon footer-social-yt" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 0 0-1.95 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/><polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="white"/></svg>
              </a>
            </div>
          </div>

        </div>
      </div>

      {/* ── Copyright bar ─────────────────────────────────────────────────── */}
      <div className="footer-copyright">
        © 2024 North America Telugu Society - NATS. All rights reserved.
      </div>

    </footer>
  );
}
