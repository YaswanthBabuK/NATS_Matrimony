import { IconPhone, IconMail, IconLock } from "../icons";

export default function ContactReveal({ profile, interestAccepted }) {
  return (
    <div className="contact-reveal">
      <h3>Contact Details</h3>
      {interestAccepted ? (
        <div className="contact-info">
          <p style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><strong><IconPhone size={14} /> Phone:</strong> {profile.phone || "Not provided"}</p>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><strong><IconMail size={14} /> Email:</strong> {profile.email || "Not provided"}</p>
        </div>
      ) : (
        <>
          <div className="contact-lock"><IconLock size={32} /></div>
          <div className="contact-blurred">+1-XXX-XXXX • user@email.com</div>
          <p className="contact-msg">
            Send interest and wait for acceptance to reveal contact details.
          </p>
        </>
      )}
    </div>
  );
}
