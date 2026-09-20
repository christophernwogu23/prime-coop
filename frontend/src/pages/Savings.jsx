import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { 
  PiggyBank, 
  Plus,
  Minus,
  Search,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle
} from 'lucide-react';

export default function Savings() {
  const { user, isAdmin } = useAuth();
  const [account, setAccount] = useState(null);
  const [allAccounts, setAllAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, [searchQuery]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (isAdmin) {
        const [accountsRes, statsRes] = await Promise.all([
          api.get('/savings/accounts', { params: { search: searchQuery } }),
          api.get('/savings/statistics')
        ]);
        setAllAccounts(accountsRes.data.accounts);
        setStatistics(statsRes.data);
      } else {
        const [accountRes, transactionsRes] = await Promise.all([
          api.get('/savings/my-account'),
          api.get('/savings/transactions')
        ]);
        setAccount(accountRes.data);
        setTransactions(transactionsRes.data.transactions);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(search);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
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
          <h1 className="text-3xl font-bold text-gray-900">Savings</h1>
          <p className="text-gray-500 mt-1">{isAdmin ? 'Manage member savings' : 'Your savings account'}</p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Admin View */}
      {isAdmin && (
        <div className="space-y-6">
          {/* Statistics */}
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-600">Total Savings</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(statistics.totalBalance)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-green-600">Total Deposits</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(statistics.totalDeposits)}
                </p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-sm text-red-600">Total Withdrawals</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(statistics.totalWithdrawals)}
                </p>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-purple-600">Active Accounts</p>
                <p className="text-2xl font-bold text-purple-700">
                  {statistics.accountCount}
                </p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearch('');
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Accounts List */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
            {allAccounts.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No accounts found</p>
            ) : (
              allAccounts.map((acc) => (
                <div
                  key={acc._id}
                  className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {acc.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{acc.userName}</p>
                        <p className="text-sm text-gray-500">{acc.userEmail}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                      <div>
                        <p className="text-gray-500">Balance</p>
                        <p className="font-semibold text-blue-600">{formatCurrency(acc.balance)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Deposits</p>
                        <p className="font-semibold text-green-600">{formatCurrency(acc.totalDeposits || 0)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Withdrawals</p>
                        <p className="font-semibold text-red-600">{formatCurrency(acc.totalWithdrawals || 0)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedUserId(acc.userId);
                        setShowDepositModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Plus size={18} />
                      Deposit
                    </button>
                    <button
                      onClick={() => {
                        setSelectedUserId(acc.userId);
                        setShowWithdrawalModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <Minus size={18} />
                      Withdraw
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Top Savers */}
          {statistics && statistics.topSavers && statistics.topSavers.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Savers</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {statistics.topSavers.map((saver, index) => (
                  <div key={saver._id} className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-600 mb-2">#{index + 1}</div>
                    <p className="font-semibold text-gray-900 truncate">{saver.userName}</p>
                    <p className="text-sm font-bold text-yellow-700 mt-2">{formatCurrency(saver.balance)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* User View */}
      {!isAdmin && account && (
        <div className="space-y-6">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center gap-3 mb-4">
              <PiggyBank className="w-8 h-8" />
              <h2 className="text-xl font-semibold">Savings Balance</h2>
            </div>
            <p className="text-4xl font-bold mb-6">{formatCurrency(account.balance)}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-blue-100 text-sm">Total Deposits</p>
                <p className="text-xl font-semibold">{formatCurrency(account.totalDeposits || 0)}</p>
              </div>
              <div>
                <p className="text-blue-100 text-sm">Total Withdrawals</p>
                <p className="text-xl font-semibold">{formatCurrency(account.totalWithdrawals || 0)}</p>
              </div>
            </div>
          </div>

          {/* Transaction History */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Transactions</h3>
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No transactions yet</p>
              ) : (
                transactions.map((transaction) => (
                  <div
                    key={transaction._id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        transaction.transactionType === 'deposit'
                          ? 'bg-green-100'
                          : 'bg-red-100'
                      }`}>
                        {transaction.transactionType === 'deposit' ? (
                          <ArrowUpCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold capitalize">{transaction.transactionType}</p>
                        <p className="text-sm text-gray-500">{formatDate(transaction.createdAt)}</p>
                        {transaction.notes && (
                          <p className="text-sm text-gray-600 mt-1">{transaction.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        transaction.transactionType === 'deposit'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        {transaction.transactionType === 'deposit' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Balance: {formatCurrency(transaction.balanceAfter)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showDepositModal && (
        <TransactionModal
          type="deposit"
          userId={selectedUserId}
          onClose={() => {
            setShowDepositModal(false);
            setSelectedUserId(null);
          }}
          onSuccess={() => {
            setShowDepositModal(false);
            setSelectedUserId(null);
            fetchData();
          }}
        />
      )}

      {showWithdrawalModal && (
        <TransactionModal
          type="withdrawal"
          userId={selectedUserId}
          onClose={() => {
            setShowWithdrawalModal(false);
            setSelectedUserId(null);
          }}
          onSuccess={() => {
            setShowWithdrawalModal(false);
            setSelectedUserId(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function TransactionModal({ type, userId, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post(`/savings/${type}/${userId}`, {
        amount: parseFloat(amount),
        transactionType: type,
        notes
      });
      onSuccess();
    } catch (error) {
      console.error(`Error recording ${type}:`, error);
      setError(error.response?.data?.detail || `Failed to record ${type}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-4 capitalize">
          {type} Funds
        </h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount (₦)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              min="1"
              step="0.01"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows="3"
              placeholder={`Add notes about this ${type}...`}
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
              className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                type === 'deposit'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {loading ? 'Processing...' : `Record ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}