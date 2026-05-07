import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  resolvePhotoUrl,
} from "../data/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const NOTIF_META = {
  interest_received: {
    icon: "💌",
    text: (name) => `${name} sent you an interest`,
    path: "/matrimony/interests",
  },
  interest_accepted: {
    icon: "✅",
    text: (name) => `${name} accepted your interest!`,
    path: "/matrimony/matches",
  },
  interest_rejected: {
    icon: "❌",
    text: (name) => `${name} declined your interest`,
    path: "/matrimony/interests",
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationBell({ profileId }) {
  const navigate        = useNavigate();
  const [notifs, setNotifs] = useState([]);
  const [open,   setOpen]   = useState(false);
  const dropRef             = useRef(null);
  const intervalRef         = useRef(null);

  const unread = notifs.filter((n) => !n.is_read).length;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchNotifs = async () => {
    if (!profileId) return;
    try {
      const data = await getNotifications(profileId);
      setNotifs(data);
    } catch { /* silent */ }
  };

  useEffect(() => {
    fetchNotifs();
    intervalRef.current = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [profileId]);

  useEffect(() => {
    window.addEventListener("interestUpdated", fetchNotifs);
    return () => window.removeEventListener("interestUpdated", fetchNotifs);
  }, []);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBellClick = async () => {
    const opening = !open;
    setOpen(opening);

    if (opening) {
      await fetchNotifs();
      // Mark all as read as soon as the user opens the dropdown
      const hasUnread = notifs.some((n) => !n.is_read);
      if (hasUnread) {
        try {
          await markAllNotificationsRead(profileId);
          setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch { /* silent */ }
      }
    }
  };

  const handleNotifClick = async (n) => {
    setOpen(false);
    if (!n.is_read) {
      try {
        await markNotificationRead(n.notification_id);
        setNotifs((prev) =>
          prev.map((x) =>
            x.notification_id === n.notification_id ? { ...x, is_read: true } : x
          )
        );
      } catch { /* ignore */ }
    }
    const meta = NOTIF_META[n.type];
    if (meta) navigate(meta.path);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(profileId);
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  };

  return (
    <div className="notif-wrap" ref={dropRef}>
      {/* Bell button */}
      <button
        className="notif-bell"
        onClick={handleBellClick}
        title="Notifications"
        aria-label={`${unread} unread notifications`}
      >
        🔔
        {unread > 0 && (
          <span className="notif-badge">{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="notif-dropdown">
          <div className="notif-header">
            <span className="notif-title">Notifications</span>
            {unread > 0 && (
              <button className="notif-mark-all" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notif-list">
            {notifs.length === 0 ? (
              <div className="notif-empty">No notifications yet</div>
            ) : (
              notifs.map((n) => {
                const meta    = NOTIF_META[n.type] || {};
                const msgText = meta.text ? meta.text(n.actor_name) : n.type;
                const photo   = resolvePhotoUrl(n.actor_photo);
                return (
                  <div
                    key={n.notification_id}
                    className={`notif-item ${n.is_read ? "" : "notif-item--unread"}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <div className="notif-avatar">
                      {photo
                        ? <img src={photo} alt={n.actor_name} className="notif-avatar-img" />
                        : <span className="notif-avatar-fallback">{meta.icon || "🔔"}</span>
                      }
                    </div>
                    <div className="notif-body">
                      <p className="notif-msg">{meta.icon} {msgText}</p>
                      <span className="notif-time">{timeAgo(n.created_at)}</span>
                    </div>
                    {!n.is_read && <span className="notif-dot" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
