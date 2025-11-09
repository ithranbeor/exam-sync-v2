import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from "../lib/supabaseClient.ts";
import '../styles/notification.css';
import { FaCheckCircle, FaTimesCircle, FaTrash, FaTrashAlt, FaEnvelopeOpenText } from "react-icons/fa";


interface UserProps {
  user: {
    user_id: number;
    email_address: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
  } | null;
}

type Notification = {
  notification_id: number;
  user_id: number;
  sender_id: number | null;
  title: string | null;
  message: string;
  type: string | null;
  status: string | null;
  link_url: string | null;
  is_seen: boolean;
  created_at: string;
  read_at: string | null;
  priority: number;
  sender_name?: string;
};

const Notification: React.FC<UserProps> = ({ user }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.user_id) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      try {
        const { data, error } = await supabase
          .from('tbl_notification')
          .select('*')
          .eq('user_id', user.user_id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const senderIds = data.map(n => n.sender_id).filter(id => id != null);
          let userMap: Record<number, string> = {};

          if (senderIds.length > 0) {
            const { data: users } = await supabase
              .from('tbl_users')
              .select('user_id, first_name, last_name')
              .in('user_id', senderIds);

            userMap = (users || []).reduce((acc, u) => {
              acc[u.user_id] = `${u.first_name} ${u.last_name}`;
              return acc;
            }, {} as Record<number, string>);
          }

          const mapped: Notification[] = data.map(n => ({
            notification_id: n.notification_id,
            user_id: n.user_id,
            sender_id: n.sender_id,
            title: n.title,
            message: n.message,
            type: n.type,
            status: n.status,
            link_url: n.link_url,
            is_seen: n.is_seen ?? false,
            created_at: n.created_at,
            read_at: n.read_at,
            priority: n.priority ?? 0,
            sender_name: n.sender_id ? (userMap[n.sender_id] || 'Unknown') : 'System'
          }));

          setNotifications(mapped);
        } else {
          setNotifications([]);
        }
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleNotificationClick = async (notif: Notification) => {
    try {
      const { error } = await supabase
        .from('tbl_notification')
        .update({ 
          is_seen: true, 
          read_at: new Date().toISOString() 
        })
        .eq('notification_id', notif.notification_id)
        .eq('user_id', user?.user_id); // ✅ make sure only the user's data updates

      if (error) {
        console.error("Error marking as read:", error);
      } else {
        setNotifications(prev => 
          prev.map(n => 
            n.notification_id === notif.notification_id 
              ? { ...n, is_seen: true, read_at: new Date().toISOString() }
              : n
          )
        );
      }

      if (notif.link_url) {
        navigate(notif.link_url);
      }
    } catch (err) {
      console.error("Error handling notification click:", err);
    }
  };

  // ✅ Delete one notification
  const handleDelete = async (notification_id: number) => {
    if (!user?.user_id) return;
    try {
      const { error } = await supabase
        .from('tbl_notification')
        .delete()
        .eq('notification_id', notification_id)
        .eq('user_id', user.user_id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.notification_id !== notification_id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  // ✅ Delete all notifications for current user
  const handleDeleteAll = async () => {
    if (!user?.user_id) return;
    if (!window.confirm('Delete all your notifications?')) return;

    try {
      const { error } = await supabase
        .from('tbl_notification')
        .delete()
        .eq('user_id', user.user_id);

      if (error) throw error;
      setNotifications([]);
    } catch (err) {
      console.error('Error deleting all notifications:', err);
    }
  };

  // ✅ Mark all as unread
  const handleMarkAllUnread = async () => {
    if (!user?.user_id) return;
    try {
      const { error } = await supabase
        .from('tbl_notification')
        .update({ is_seen: false, read_at: null })
        .eq('user_id', user.user_id);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n => ({ ...n, is_seen: false, read_at: null }))
      );
    } catch (err) {
      console.error('Error marking all unread:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_seen).length;

  if (loading) {
    return (
      <div className="notification-container">
        <div className="notification-banner">Notifications</div>
        <p className="notification-message">Loading notifications...</p>
      </div>
    );
  }

  return (
    <div className="notification-container">
      <div className="notification-banner">
        <span>Notifications</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="notif-btn" title="Mark all as unread" onClick={handleMarkAllUnread}>
            <FaEnvelopeOpenText />
          </button>
          <button className="notif-btn" title="Delete all" onClick={handleDeleteAll}>
            <FaTrashAlt />
          </button>
        </div>
      </div>

      <p className="notification-message">
        You have {unreadCount} unread notification(s)
        {notifications.length > 0 && ` (Total: ${notifications.length})`}
      </p>

      {notifications.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 20px', 
          color: '#666',
          fontSize: '14px'
        }}>
          No notifications yet
        </div>
      ) : (
        notifications.map((notif) => (
          <div
            key={notif.notification_id}
            className="notification-card"
            onClick={() => handleNotificationClick(notif)}
            style={{
              backgroundColor: notif.is_seen ? '#f9f9f9' : '#fff',
              fontWeight: notif.is_seen ? 'normal' : 'bold',
              borderLeft: notif.is_seen ? '3px solid #ccc' : '3px solid #092C4C',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <div className="notif-left">
              <span className="notif-icon">
                {notif.priority === 2 ? (
                  <FaTimesCircle style={{color: '#f44336'}}/>
                ) : notif.priority === 1 ? (
                  <FaCheckCircle style={{color: '#4CAF50'}} />
                ) : (
                  '⏵'
                )}
              </span>
              <span className="notif-sender">{notif.sender_name || 'System'}</span>
            </div>

            <div className="notif-center">
              {notif.title && (
                <>
                  <strong>{notif.title}</strong>
                  <br />
                </>
              )}
              {notif.message}
            </div>

            <div className="notif-date">
              {new Date(notif.created_at).toLocaleString()}
            </div>

            {/* Delete single notification */}
            <button
              className="notif-delete-btn"
              title="Delete notification"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(notif.notification_id);
              }}
            >
              <FaTrash />
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default Notification;
