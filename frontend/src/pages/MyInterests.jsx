import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SubNav from "../components/SubNav";
import { getInterestsSent, getInterestsReceived, updateInterest, resolvePhotoUrl } from "../data/api";

// ─── Status pill ──────────────────────────────────────────────────────────────

const StatusPill = ({ status }) => (
  <span className={`status-pill status-${status}`}>
    {status === "accepted" ? "✅ Accepted" :
     status === "rejected" ? "❌ Declined" :
     "⏳ Pending"}
  </span>
);

// ─── Mutual Match inline banner ───────────────────────────────────────────────

function MutualMatchRow({ person }) {
  return (
    <tr style={{ background: "#d4edda" }}>
      <td colSpan={6} style={{ padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20 }}>🎉</span>
          <div>
            <strong style={{ color: "#155724" }}>Mutual Match with {person.full_name}!</strong>
            <div style={{ fontSize: 12, color: "#155724", marginTop: 2 }}>
              {person.phone && <span>📞 {person.phone}&nbsp;&nbsp;</span>}
              {person.email && <span>✉️ {person.email}</span>}
              {!person.phone && !person.email && "Contact details not available"}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyInterests() {
  const [tab, setTab]         = useState("sent");
  const [sent, setSent]       = useState([]);
  const [received, setReceived] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate              = useNavigate();
  const currentId             = sessionStorage.getItem("currentProfileId");

  const load = async () => {
    if (!currentId) return;
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        getInterestsSent(currentId),
        getInterestsReceived(currentId),
      ]);
      setSent(s);
      setReceived(r);
    } catch {
      setSent([]);
      setReceived([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    window.addEventListener("profileSwitched", load);
    return () => window.removeEventListener("profileSwitched", load);
  }, []);

  const handleRespond = async (interestId, status) => {
    try {
      await updateInterest(interestId, status);
      load();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to update interest.");
    }
  };

  const rows = tab === "sent" ? sent : received;

  return (
    <>
      <SubNav />
      <div className="page-banner">
        <h1>Interests</h1>
        <p>Manage your interest requests and responses</p>
      </div>

      <div className="interests-page page-content">
        {/* Tabs */}
        <div className="tabs">
          <button className={`tab-btn${tab === "sent" ? " active" : ""}`} onClick={() => setTab("sent")}>
            Interests Sent&nbsp;
            <span style={{ background: "#8B0000", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{sent.length}</span>
          </button>
          <button className={`tab-btn${tab === "received" ? " active" : ""}`} onClick={() => setTab("received")}>
            Interests Received&nbsp;
            <span style={{ background: "#8B0000", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>
              {received.filter(i => i.status === "pending").length}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-msg">
            {tab === "sent" ? "You haven't sent any interests yet." : "No interests received yet."}
          </div>
        ) : (
          <table className="interest-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Name</th>
                <th>Age</th>
                <th>Location</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((interest) => {
                const person = tab === "sent" ? interest.receiver : interest.sender;
                if (!person) return null;

                return (
                  <React.Fragment key={interest.interest_id}>
                  <tr
                    style={interest.status === "accepted" ? { borderLeft: "4px solid #27ae60" } : {}}
                  >
                      <td>
                        <img
                          className="interest-thumb"
                          src={resolvePhotoUrl(person.profile_photo_url) || "https://via.placeholder.com/46"}
                          alt={person.full_name}
                          style={{ cursor: "pointer" }}
                          onClick={() => navigate(`/matrimony/profile/${person.profile_id}`)}
                        />
                      </td>
                      <td>
                        <span
                          style={{ cursor: "pointer", color: "#8B0000", fontWeight: 600 }}
                          onClick={() => navigate(`/matrimony/profile/${person.profile_id}`)}
                        >
                          {person.full_name}
                        </span>
                        <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                          {person.religion}{person.caste ? ` · ${person.caste}` : ""}
                        </div>
                      </td>
                      <td>{person.age}</td>
                      <td>{person.current_city}, {person.current_state}</td>
                      <td><StatusPill status={interest.status} /></td>
                      <td>
                        {/* ── Received + pending → Accept / Decline buttons ── */}
                        {tab === "received" && interest.status === "pending" && (
                          <div className="action-btns">
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleRespond(interest.interest_id, "accepted")}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleRespond(interest.interest_id, "rejected")}
                            >
                              Decline
                            </button>
                          </div>
                        )}

                        {/* ── Sent + accepted → View contact ── */}
                        {tab === "sent" && interest.status === "accepted" && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => navigate(`/matrimony/profile/${person.profile_id}`)}
                          >
                            View Contact
                          </button>
                        )}

                        {/* ── Already resolved ── */}
                        {interest.status !== "pending" && !(tab === "sent" && interest.status === "accepted") && (
                          <span style={{ fontSize: 12, color: "#aaa" }}>—</span>
                        )}
                      </td>
                    </tr>

                    {/* Mutual Match inline details row */}
                    {interest.status === "accepted" && (
                      <MutualMatchRow person={person} />
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
