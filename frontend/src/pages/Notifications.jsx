import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import {
  Bell, BellOff, Trash2, CheckCheck, RefreshCw,
  CreditCard, Shield, PiggyBank, DollarSign, AlertCircle
} from 'lucide-react';

const TYPE_CONFIG = {
  loan_applied:       { icon: CreditCard,  color: 'bg-blue-100 text-blue-600',   label: 'Loan Applied' },
  guarantor_request:  { icon: Shield,      color: 'bg-yellow-100 text-yellow-600', label: 'Guarantor Request' },
  guarantor_approved: { icon: Shield,      color: 'bg-green-100 text-green-600',  label: 'Guarantor Approved' },
  guarantor_rejected: { icon: Shield,      color: 'bg-red-100 text-red-600',      label: 'Guarantor Rejected' },
  loan_granted:       { icon: CreditCard,  color: 'bg-green-100 text-green-600',  label: 'Loan Granted' },
  loan_rejected:      { icon: CreditCard,  color: 'bg-red-100 text-red-600',      label: 'Loan Rejected' },
  payment_recorded:   { icon: DollarSign,  color: 'bg-purple-100 text-purple-600', label: 'Payment Recorded' },
  savings_confirmed:  { icon: PiggyBank,   color: 'bg-teal-100 text-teal-600',    label: 'Savings Confirmed' },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || { icon: AlertCircle, color: 'bg-gray-100 text-gray-600', label: type };
}

export default function Notifications() {
  const { isAdmin } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread | read
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleMarkUnread = async (id) => {
    try {
      await api.put(`/notifications/${id}/unread`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: false } : n));
      setUnreadCount(prev => prev + 1);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const n = notifications.find(n => n._id === id);
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      if (n && !n.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Clear all notifications? This cannot be undone.')) return;
    try {
      await api.delete('/notifications/clear-all/all');
      setNotifications([]);
      setUnreadCount(0);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter(n => !n.isRead);
      await Promise.all(unread.map(n => api.put(`/notifications/${n._id}/read`)));
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'read') return n.isRead;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-gray-500 mt-1">
            {isAdmin ? 'All member notifications' : 'Your activity and updates'}
            {unreadCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full font-medium">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchNotifications} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Refresh">
            <RefreshCw size={20} />
          </button>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              <CheckCheck size={16} />Mark all read
            </button>
          )}
          {notifications.length > 0 && (
            <button onClick={handleClearAll} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm">
              <Trash2 size={16} />Clear all
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { key: 'all',    label: `All (${notifications.length})` },
              { key: 'unread', label: `Unread (${unreadCount})` },
              { key: 'read',   label: `Read (${notifications.length - unreadCount})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-6 py-3 font-medium text-sm ${filter === tab.key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell size={48} className="mb-4 opacity-30" />
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm mt-1">
                {filter === 'unread' ? 'You\'re all caught up!' : 'Nothing to show here'}
              </p>
            </div>
          ) : (
            filteredNotifications.map(notification => {
              const config = getTypeConfig(notification.type);
              const Icon = config.icon;
              return (
                <div
                  key={notification._id}
                  className={`flex items-start gap-4 p-4 lg:p-5 hover:bg-gray-50 transition-colors ${!notification.isRead ? 'bg-blue-50/40' : ''}`}
                >
                  {/* Icon */}
                  <div className={`p-2 rounded-full flex-shrink-0 ${config.color}`}>
                    <Icon size={18} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {isAdmin && notification.userName && (
                          <p className="text-xs text-gray-500 mb-0.5">{notification.userName}</p>
                        )}
                        <p className={`text-sm font-semibold ${!notification.isRead ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                          {!notification.isRead && (
                            <span className="ml-2 inline-block w-2 h-2 bg-blue-500 rounded-full align-middle"></span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500 mt-0.5">{notification.message}</p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(notification.createdAt)}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.isRead ? (
                          <button
                            onClick={() => handleMarkRead(notification._id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                            title="Mark as read"
                          >
                            <CheckCheck size={16} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkUnread(notification._id)}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                            title="Mark as unread"
                          >
                            <BellOff size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification._id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Type badge */}
                    <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full font-medium ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}