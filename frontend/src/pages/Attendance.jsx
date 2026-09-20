import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { 
  Calendar, 
  Plus,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react';

export default function Attendance() {
  const { user, isAdmin } = useAuth();
  const [records, setRecords] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [recordsRes, statsRes] = await Promise.all([
        api.get('/attendance'),
        isAdmin ? api.get('/attendance/statistics/overview') : Promise.resolve({ data: null })
      ]);
      setRecords(recordsRes.data.records);
      if (isAdmin) {
        setStatistics(statsRes.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) {
      return;
    }

    try {
      await api.delete(`/attendance/${recordId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Failed to delete attendance record');
    }
  };

  const viewDetails = async (recordId) => {
    try {
      const response = await api.get(`/attendance/${recordId}`);
      setSelectedRecord(response.data);
      setShowMarkModal(true);
    } catch (error) {
      console.error('Error fetching record details:', error);
    }
  };

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 mt-1">Track meeting attendance</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchData}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <RefreshCw size={20} />
          </button>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Create Meeting
            </button>
          )}
        </div>
      </div>

      {/* Statistics (Admin Only) */}
      {isAdmin && statistics && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <p className="text-blue-100 text-sm">Total Meetings</p>
            <p className="text-3xl font-bold mt-1">{statistics.totalMeetings}</p>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
            <p className="text-green-100 text-sm">Present (2pts)</p>
            <p className="text-3xl font-bold mt-1">{statistics.totalPresent}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-4 text-white">
            <p className="text-yellow-100 text-sm">Online (1pt)</p>
            <p className="text-3xl font-bold mt-1">{statistics.totalOnline}</p>
          </div>
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-4 text-white">
            <p className="text-red-100 text-sm">Absent (0pts)</p>
            <p className="text-3xl font-bold mt-1">{statistics.totalAbsent}</p>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <p className="text-purple-100 text-sm">Avg Rate</p>
            <p className="text-3xl font-bold mt-1">{statistics.averageAttendanceRate.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Top Attendees (Admin Only) */}
      {isAdmin && statistics?.topAttendees && statistics.topAttendees.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Attendees</h3>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {statistics.topAttendees.map((attendee, index) => (
              <div key={attendee.userId} className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600 mb-2">#{index + 1}</div>
                <p className="font-semibold text-gray-900 truncate">{attendee.userName}</p>
                <p className="text-sm text-yellow-700 mt-1">{attendee.totalPoints} points</p>
                <p className="text-xs text-yellow-600">
                  {attendee.presentCount}P • {attendee.onlineCount}O
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Records List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
        {records.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No meeting records yet</p>
        ) : (
          records.map((record) => (
            <div
              key={record._id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-lg">{record.title}</h3>
                  </div>
                  {record.description && (
                    <p className="text-sm text-gray-600 mb-3">{record.description}</p>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Meeting Date</p>
                      <p className="font-semibold">{formatDateTime(record.meetingDate)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Location</p>
                      <p className="font-semibold">{record.location || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Attendance</p>
                      <p className="font-semibold">
                        <span className="text-green-600">{record.presentCount}P</span> • 
                        <span className="text-yellow-600"> {record.onlineCount}O</span> • 
                        <span className="text-red-600"> {record.absentCount}A</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Points</p>
                      <p className="font-semibold text-purple-600">
                        {record.totalPoints}/{record.maxPoints}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rate</p>
                      <p className="font-semibold text-blue-600">{record.attendanceRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => viewDetails(record._id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye size={18} />
                        Mark
                      </button>
                      <button
                        onClick={() => handleDelete(record._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Meeting Modal */}
      {showCreateModal && (
        <CreateMeetingModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}

      {/* Mark Attendance Modal */}
      {showMarkModal && selectedRecord && (
        <MarkAttendanceModal
          record={selectedRecord}
          onClose={() => {
            setShowMarkModal(false);
            setSelectedRecord(null);
          }}
          onSuccess={() => {
            setShowMarkModal(false);
            setSelectedRecord(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// Create Meeting Modal Component
function CreateMeetingModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    meetingDate: '',
    location: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/attendance', {
        ...formData,
        meetingDate: new Date(formData.meetingDate).toISOString()
      });
      alert('Meeting created successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error creating meeting:', error);
      setError(error.response?.data?.detail || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Create Meeting</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              placeholder="e.g., Monthly General Meeting"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Date & Time</label>
            <input
              type="datetime-local"
              value={formData.meetingDate}
              onChange={(e) => setFormData({ ...formData, meetingDate: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Location (Optional)</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Community Hall"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder="Meeting agenda or notes..."
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Mark Attendance Modal Component
function MarkAttendanceModal({ record, onClose, onSuccess }) {
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initialMarks = {};
    record.marks?.forEach(mark => {
      initialMarks[mark.userId] = mark.status;
    });
    setMarks(initialMarks);
  }, [record]);

  const setMark = (userId, status) => {
    setMarks(prev => ({
      ...prev,
      [userId]: status
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const marksArray = Object.entries(marks).map(([userId, status]) => ({
        userId,
        status
      }));

      await api.put(`/attendance/${record._id}/mark`, marksArray);
      alert('Attendance marked successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error marking attendance:', error);
      alert('Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  const presentCount = Object.values(marks).filter(s => s === 'present').length;
  const onlineCount = Object.values(marks).filter(s => s === 'online').length;
  const absentCount = Object.values(marks).filter(s => s === 'absent').length;
  const totalPoints = presentCount * 2 + onlineCount * 1;
  const maxPoints = Object.keys(marks).length * 2;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full p-6 my-8">
        <h3 className="text-2xl font-semibold text-gray-900 mb-2">{record.title}</h3>
        <p className="text-gray-600 mb-6">
          {new Date(record.meetingDate).toLocaleDateString('en-NG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
          {record.location && ` • ${record.location}`}
        </p>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <p className="text-sm text-blue-600">Total Members</p>
            <p className="text-2xl font-bold text-blue-700">{record.marks?.length || 0}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-sm text-green-600">Present (2pts)</p>
            <p className="text-2xl font-bold text-green-700">{presentCount}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-sm text-yellow-600">Online (1pt)</p>
            <p className="text-2xl font-bold text-yellow-700">{onlineCount}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-sm text-red-600">Absent (0pts)</p>
            <p className="text-2xl font-bold text-red-700">{absentCount}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <p className="text-sm text-purple-600">Total Points</p>
            <p className="text-2xl font-bold text-purple-700">{totalPoints}/{maxPoints}</p>
          </div>
        </div>

        {/* Members List */}
        <form onSubmit={handleSubmit}>
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Member</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {record.marks?.map((mark) => (
                    <tr key={mark.userId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">{mark.userName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setMark(mark.userId, 'present')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              marks[mark.userId] === 'present'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Present (2)
                          </button>
                          <button
                            type="button"
                            onClick={() => setMark(mark.userId, 'online')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              marks[mark.userId] === 'online'
                                ? 'bg-yellow-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Online (1)
                          </button>
                          <button
                            type="button"
                            onClick={() => setMark(mark.userId, 'absent')}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                              marks[mark.userId] === 'absent'
                                ? 'bg-red-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Absent (0)
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}