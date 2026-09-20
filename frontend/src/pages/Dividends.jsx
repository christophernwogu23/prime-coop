import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { 
  TrendingUp, 
  Plus,
  Eye,
  CheckCircle,
  DollarSign,
  RefreshCw
} from 'lucide-react';

export default function Dividends() {
  const { user, isAdmin } = useAuth();
  const [dividends, setDividends] = useState([]);
  const [myDividends, setMyDividends] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDividend, setSelectedDividend] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (isAdmin) {
        const [dividendsRes, statsRes] = await Promise.all([
          api.get('/dividends'),
          api.get('/dividends/statistics/overview')
        ]);
        setDividends(dividendsRes.data.dividends);
        setStatistics(statsRes.data);
      } else {
        const response = await api.get('/dividends/my-dividends');
        setMyDividends(response.data.payments);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDistribute = async (dividendId) => {
    if (!window.confirm('Are you sure you want to distribute this dividend? This will add the amounts to members\' savings accounts.')) {
      return;
    }

    try {
      await api.put(`/dividends/${dividendId}/distribute`);
      alert('Dividend distributed successfully!');
      fetchData();
    } catch (error) {
      console.error('Error distributing dividend:', error);
      alert(error.response?.data?.detail || 'Failed to distribute dividend');
    }
  };

  const viewDetails = async (dividendId) => {
    try {
      const response = await api.get(`/dividends/${dividendId}`);
      setSelectedDividend(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error fetching dividend details:', error);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { color: 'bg-yellow-100 text-yellow-700', text: 'Pending' },
      'distributed': { color: 'bg-green-100 text-green-700', text: 'Distributed' },
      'paid': { color: 'bg-green-100 text-green-700', text: 'Paid' }
    };
    const badge = badges[status] || { color: 'bg-gray-100 text-gray-700', text: status };
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${badge.color}`}>{badge.text}</span>;
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
          <h1 className="text-3xl font-bold text-gray-900">Dividends</h1>
          <p className="text-gray-500 mt-1">{isAdmin ? 'Manage profit distributions' : 'Your dividend history'}</p>
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
              Create Dividend
            </button>
          )}
        </div>
      </div>

      {/* Admin View */}
      {isAdmin && (
        <div className="space-y-6">
          {/* Statistics */}
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
                <p className="text-blue-100 text-sm">Total Distributed</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(statistics.totalAmountDistributed)}
                </p>
                <p className="text-blue-100 text-xs mt-2">
                  {statistics.distributedDividends} dividends
                </p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-4 text-white">
                <p className="text-yellow-100 text-sm">Pending Distribution</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(statistics.totalAmountPending)}
                </p>
                <p className="text-yellow-100 text-xs mt-2">
                  {statistics.pendingDividends} dividends
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
                <p className="text-green-100 text-sm">Total Amount</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(statistics.totalAmountAll)}
                </p>
                <p className="text-green-100 text-xs mt-2">
                  {statistics.totalDividends} total
                </p>
              </div>
            </div>
          )}

          {/* Dividends List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
            {dividends.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No dividends created yet</p>
            ) : (
              dividends.map((dividend) => (
                <div
                  key={dividend._id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        <h3 className="font-semibold text-lg">{dividend.title}</h3>
                        {getStatusBadge(dividend.status)}
                      </div>
                      {dividend.description && (
                        <p className="text-sm text-gray-600 mb-3">{dividend.description}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Amount</p>
                          <p className="font-semibold text-green-600">
                            {formatCurrency(dividend.totalAmount)}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">Recipients</p>
                          <p className="font-semibold">{dividend.totalRecipients} members</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Method</p>
                          <p className="font-semibold capitalize">{dividend.distributionMethod}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Created</p>
                          <p className="font-semibold">{formatDate(dividend.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => viewDetails(dividend._id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={20} />
                      </button>
                      {dividend.status === 'pending' && (
                        <button
                          onClick={() => handleDistribute(dividend._id)}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <CheckCircle size={18} />
                          Distribute
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* User View */}
      {!isAdmin && (
        <div className="space-y-6">
          {myDividends.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">No dividend payments yet</p>
            </div>
          ) : (
            <>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-8 h-8" />
                  <h2 className="text-xl font-semibold">Total Dividends Received</h2>
                </div>
                <p className="text-3xl font-bold">
                  {formatCurrency(myDividends.reduce((sum, d) => sum + d.amount, 0))}
                </p>
                <p className="text-green-100 text-sm mt-2">
                  {myDividends.length} dividend payments
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                {myDividends.map((payment) => (
                  <div
                    key={payment._id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{payment.dividendTitle || 'Dividend Payment'}</h3>
                            <p className="text-sm text-gray-500">
                              {formatDate(payment.createdAt)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-3">
                          <div>
                            <p className="text-gray-500">Amount Received</p>
                            <p className="font-semibold text-green-600">{formatCurrency(payment.amount)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Your Savings Then</p>
                            <p className="font-semibold">{formatCurrency(payment.savingsBalance)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Distribution</p>
                            <p className="font-semibold capitalize">{payment.distributionMethod || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(payment.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Create Dividend Modal */}
      {showCreateModal && (
        <CreateDividendModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchData();
          }}
        />
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDividend && (
        <DividendDetailsModal
          dividend={selectedDividend}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedDividend(null);
          }}
        />
      )}
    </div>
  );
}

function CreateDividendModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    totalAmount: '',
    distributionMethod: 'proportional',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/dividends', {
        ...formData,
        totalAmount: parseFloat(formData.totalAmount)
      });
      alert('Dividend created successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error creating dividend:', error);
      setError(error.response?.data?.detail || 'Failed to create dividend');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">Create Dividend</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              placeholder="e.g., Q4 2024 Profit Distribution"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Amount (₦)
            </label>
            <input
              type="number"
              value={formData.totalAmount}
              onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              min="1"
              step="0.01"
              placeholder="1000000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Distribution Method
            </label>
            <select
              value={formData.distributionMethod}
              onChange={(e) => setFormData({ ...formData, distributionMethod: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="proportional">Proportional to Savings</option>
              <option value="equal">Equal Distribution</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.distributionMethod === 'proportional' 
                ? 'Members with higher savings get higher dividends'
                : 'All members get the same amount'
              }
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder="Additional details about this dividend..."
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
              {loading ? 'Creating...' : 'Create Dividend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DividendDetailsModal({ dividend, onClose }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full p-6 my-8">
        <h3 className="text-2xl font-semibold text-gray-900 mb-6">{dividend.title}</h3>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-600">Total Amount</p>
            <p className="text-xl font-bold text-blue-700">{formatCurrency(dividend.totalAmount)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <p className="text-sm text-green-600">Paid</p>
            <p className="text-xl font-bold text-green-700">
              {formatCurrency(dividend.statistics?.totalPaid || 0)}
            </p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4">
            <p className="text-sm text-yellow-600">Pending</p>
            <p className="text-xl font-bold text-yellow-700">
              {formatCurrency(dividend.statistics?.totalPending || 0)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <p className="text-sm text-purple-600">Recipients</p>
            <p className="text-xl font-bold text-purple-700">{dividend.totalRecipients}</p>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <p className="text-gray-500">Distribution Method</p>
            <p className="font-semibold capitalize">{dividend.distributionMethod}</p>
          </div>
          <div>
            <p className="text-gray-500">Created By</p>
            <p className="font-semibold">{dividend.createdByName}</p>
          </div>
          <div>
            <p className="text-gray-500">Created Date</p>
            <p className="font-semibold">{formatDate(dividend.createdAt)}</p>
          </div>
          <div>
            <p className="text-gray-500">Distributed Date</p>
            <p className="font-semibold">{formatDate(dividend.distributedAt)}</p>
          </div>
        </div>

        {dividend.description && (
          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">Description</p>
            <p className="text-gray-900">{dividend.description}</p>
          </div>
        )}

        {/* Payments Table */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Payment Details</h4>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Member</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Savings Balance</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dividend.payments?.map((payment) => (
                    <tr key={payment._id}>
                      <td className="px-4 py-2 text-sm">{payment.userName}</td>
                      <td className="px-4 py-2 text-sm text-right">{formatCurrency(payment.savingsBalance)}</td>
                      <td className="px-4 py-2 text-sm text-right font-semibold text-green-600">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                          payment.status === 'paid' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}