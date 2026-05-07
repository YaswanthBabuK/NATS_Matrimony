export default function ContactReveal({ profile, interestAccepted }) {
  return (
    <div className="contact-reveal">
      <h3>Contact Details</h3>
      {interestAccepted ? (
        <div className="contact-info">
          <p><strong>📞 Phone:</strong> {profile.phone || "Not provided"}</p>
          <p><strong>✉️ Email:</strong> {profile.email || "Not provided"}</p>
        </div>
      ) : (
        <>
          <div className="contact-lock">🔒</div>
          <div className="contact-blurred">+1-XXX-XXXX • user@email.com</div>
          <p className="contact-msg">
            Send interest and wait for acceptance to reveal contact details.
          </p>
        </>
      )}
    </div>
  );
}
