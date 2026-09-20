import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { Plus, Wallet, CheckCircle, XCircle, DollarSign, Eye, Trash2, Edit, Search, X, UserPlus } from 'lucide-react';

export default function Loans() {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(isAdmin ? 'active-loans' : 'my-loans');
  const [loans, setLoans] = useState([]);
  const [guaranteeRequests, setGuaranteeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showAdminApplyModal, setShowAdminApplyModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditLoanModal, setShowEditLoanModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [users, setUsers] = useState([]);           // guarantor list for members
  const [allMembers, setAllMembers] = useState([]); // full member list for admin
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    if (!isAdmin) {
      fetchUsers();
    } else {
      fetchAllMembers();
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'my-loans') {
        const response = await api.get('/loans');
        setLoans(response.data.loans);
      } else if (activeTab === 'guarantees') {
        const response = await api.get('/loans/my-guarantees');
        setGuaranteeRequests(response.data);
      } else if (activeTab === 'active-loans') {
        const response = await api.get('/loans');
        setLoans(response.data.loans.filter(l => ['granted', 'completed'].includes(l.status)));
      } else if (activeTab === 'pending-loans') {
        const response = await api.get('/loans');
        setLoans(response.data.loans.filter(l => ['approved', 'guarantor_approval', 'pending'].includes(l.status)));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // For members — guarantor picker (name + _id only)
  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/guarantor-list');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching guarantors:', error);
    }
  };

  // For admin — full member list for borrower selector + guarantor pickers
  const fetchAllMembers = async () => {
    try {
      const response = await api.get('/users?limit=100');
      setAllMembers(response.data.users || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const filteredLoans = activeTab === 'active-loans' && searchQuery.trim()
    ? loans.filter(l => l.userName?.toLowerCase().includes(searchQuery.toLowerCase()))
    : loans;

  const formatCurrency = (amount) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  const getStatusBadge = (status) => {
    const badges = {
      'guarantor_approval': { color: 'bg-yellow-100 text-yellow-700',  text: 'Pending Guarantors' },
      'approved':           { color: 'bg-blue-100 text-blue-700',      text: 'Pending Admin' },
      'pending':            { color: 'bg-orange-100 text-orange-700',  text: 'Awaiting Grant' },
      'granted':            { color: 'bg-green-100 text-green-700',    text: 'Active' },
      'completed':          { color: 'bg-gray-100 text-gray-700',      text: 'Completed' },
      'rejected':           { color: 'bg-red-100 text-red-700',        text: 'Rejected' },
    };
    const badge = badges[status] || { color: 'bg-gray-100 text-gray-700', text: status };
    return <span className={`px-2 py-1 text-xs rounded-full font-medium ${badge.color}`}>{badge.text}</span>;
  };

  const handleGuarantorResponse = async (loanId, response) => {
    try {
      await api.put(`/loans/${loanId}/guarantor-response?response=${response}`);
      fetchData();
      alert(`Loan ${response === 'approve' ? 'approved' : 'rejected'}`);
    } catch (error) {
      alert('Failed');
    }
  };

  const handleAdminApprove = async (loanId) => {
    try {
      await api.put(`/loans/${loanId}/approve`);
      fetchData();
      alert('Loan granted');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed');
    }
  };

  const handleAdminReject = async (loanId) => {
    if (!window.confirm('Reject this loan?')) return;
    try {
      await api.put(`/loans/${loanId}/reject`);
      fetchData();
      alert('Loan rejected');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed');
    }
  };

  const handleDelete = async (loanId) => {
    if (!window.confirm('Delete this loan?')) return;
    try {
      await api.delete(`/loans/${loanId}`);
      fetchData();
      alert('Deleted');
    } catch (error) {
      alert('Failed');
    }
  };

  const handleEditLoan = async (loanId, data) => {
    try {
      await api.put(`/loans/${loanId}/edit`, data);
      setShowEditLoanModal(false);
      setSelectedLoan(null);
      fetchData();
      alert('Updated');
    } catch (error) {
      alert('Failed');
    }
  };

  const handleEditPayment = async (paymentId, amount, date, notes) => {
    try {
      await api.put(`/loans/payment/${paymentId}`, {
        amount: parseFloat(amount),
        payment_date: date ? new Date(date).toISOString() : null,
        notes
      });
      setShowEditPaymentModal(false);
      setSelectedPayment(null);
      if (selectedLoan) {
        const response = await api.get(`/loans/${selectedLoan._id}`);
        setSelectedLoan(response.data);
      }
      fetchData();
      alert('Updated');
    } catch (error) {
      alert('Failed');
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Delete payment?')) return;
    try {
      await api.delete(`/loans/payment/${paymentId}`);
      if (selectedLoan) {
        const response = await api.get(`/loans/${selectedLoan._id}`);
        setSelectedLoan(response.data);
      }
      fetchData();
      alert('Deleted');
    } catch (error) {
      alert('Failed');
    }
  };

  const viewLoanDetails = async (loan) => {
    try {
      const response = await api.get(`/loans/${loan._id}`);
      setSelectedLoan(response.data);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading && loans.length === 0 && guaranteeRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Loans</h1>
          <p className="text-gray-500 mt-1">{isAdmin ? 'Manage cooperative loans' : 'Your loans and guarantees'}</p>
        </div>
        <div className="flex gap-3">
          {/* Admin: Apply loan for a member */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminApplyModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <UserPlus size={20} />Apply for Member
            </button>
          )}
          {/* Member: Apply for own loan */}
          {!isAdmin && (
            <button
              onClick={async () => { await fetchUsers(); setShowApplyModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />Apply for Loan
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex overflow-x-auto">
            {!isAdmin ? (
              <>
                <button onClick={() => setActiveTab('my-loans')} className={`px-6 py-3 font-medium ${activeTab === 'my-loans' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>My Loans</button>
                <button onClick={() => setActiveTab('guarantees')} className={`px-6 py-3 font-medium ${activeTab === 'guarantees' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Guarantees</button>
              </>
            ) : (
              <>
                <button onClick={() => setActiveTab('active-loans')} className={`px-6 py-3 font-medium ${activeTab === 'active-loans' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Active Loans</button>
                <button onClick={() => setActiveTab('pending-loans')} className={`px-6 py-3 font-medium ${activeTab === 'pending-loans' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>Pending Loans</button>
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {/* Search bar — Admin Active Loans only */}
          {isAdmin && activeTab === 'active-loans' && (
            <div className="mb-5">
              <div className="relative max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by member name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                )}
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 mt-2">
                  {filteredLoans.length} result{filteredLoans.length !== 1 ? 's' : ''} for "<span className="font-medium">{searchQuery}</span>"
                </p>
              )}
            </div>
          )}

          {activeTab === 'my-loans' && !isAdmin && (
            <div className="space-y-4">
              {loans.length === 0
                ? <p className="text-center text-gray-500 py-8">No loans</p>
                : loans.map(l => (
                    <LoanCard key={l._id} loan={l} onView={viewLoanDetails} formatCurrency={formatCurrency} formatDate={formatDate} getStatusBadge={getStatusBadge} />
                  ))
              }
            </div>
          )}

          {activeTab === 'guarantees' && !isAdmin && (
            <div className="space-y-4">
              {guaranteeRequests.length === 0
                ? <p className="text-center text-gray-500 py-8">No requests</p>
                : guaranteeRequests.map(l => (
                    <GuaranteeCard key={l._id} loan={l} onRespond={handleGuarantorResponse} formatCurrency={formatCurrency} />
                  ))
              }
            </div>
          )}

          {(activeTab === 'active-loans' || activeTab === 'pending-loans') && (
            <div className="space-y-4">
              {filteredLoans.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  {searchQuery
                    ? `No active loans found for "${searchQuery}"`
                    : activeTab === 'pending-loans' ? 'No pending loans' : 'No active loans'
                  }
                </p>
              ) : (
                filteredLoans.map(l => (
                  <AdminLoanCard
                    key={l._id}
                    loan={l}
                    isActive={activeTab === 'active-loans'}
                    onView={viewLoanDetails}
                    onEdit={() => { setSelectedLoan(l); setShowEditLoanModal(true); }}
                    onDelete={handleDelete}
                    onApprove={handleAdminApprove}
                    onReject={handleAdminReject}
                    onAddPayment={() => { setSelectedLoan(l); setShowPaymentModal(true); }}
                    formatCurrency={formatCurrency}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Member apply modal */}
      {showApplyModal && (
        <ApplyLoanModal
          onClose={() => setShowApplyModal(false)}
          onSuccess={() => { setShowApplyModal(false); fetchData(); }}
          users={users}
          currentUser={user}
        />
      )}

      {/* Admin apply for member modal */}
      {showAdminApplyModal && (
        <AdminApplyLoanModal
          onClose={() => setShowAdminApplyModal(false)}
          onSuccess={() => {
            setShowAdminApplyModal(false);
            setActiveTab('active-loans');
            fetchData();
          }}
          members={allMembers}
        />
      )}

      {showDetailsModal && selectedLoan && (
        <LoanDetailsModal
          loan={selectedLoan}
          onClose={() => { setShowDetailsModal(false); setSelectedLoan(null); }}
          onEditPayment={(p) => { setSelectedPayment(p); setShowEditPaymentModal(true); }}
          onDeletePayment={handleDeletePayment}
        />
      )}
      {showPaymentModal && selectedLoan && (
        <PaymentModal
          loan={selectedLoan}
          onClose={() => { setShowPaymentModal(false); setSelectedLoan(null); }}
          onSuccess={() => { setShowPaymentModal(false); setSelectedLoan(null); fetchData(); }}
        />
      )}
      {showEditLoanModal && selectedLoan && (
        <EditLoanModal
          loan={selectedLoan}
          onClose={() => { setShowEditLoanModal(false); setSelectedLoan(null); }}
          onSave={handleEditLoan}
        />
      )}
      {showEditPaymentModal && selectedPayment && (
        <EditPaymentModal
          payment={selectedPayment}
          onClose={() => { setShowEditPaymentModal(false); setSelectedPayment(null); }}
          onSave={handleEditPayment}
        />
      )}
    </div>
  );
}

// ─── Member loan card ─────────────────────────────────────────────────────────
function LoanCard({ loan, onView, formatCurrency, formatDate, getStatusBadge }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-lg">{loan.loanType} Loan</h3>
            {getStatusBadge(loan.status)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-3">
            <div><p className="text-gray-500">Amount</p><p className="font-semibold">{formatCurrency(loan.amount)}</p></div>
            <div><p className="text-gray-500">Remaining</p><p className="font-semibold text-red-600">{formatCurrency(loan.remainingBalance)}</p></div>
            <div><p className="text-gray-500">Monthly</p><p className="font-semibold">{formatCurrency(loan.totalRepaymentAmount / loan.repaymentSchedule)}</p></div>
            <div>
              <p className="text-gray-500">Progress</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${loan.paymentProgress}%` }} />
              </div>
            </div>
          </div>
        </div>
        <button onClick={() => onView(loan)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
          <Eye size={20} />
        </button>
      </div>
    </div>
  );
}

// ─── Guarantee card ───────────────────────────────────────────────────────────
function GuaranteeCard({ loan, onRespond, formatCurrency }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-lg">{loan.userName}'s {loan.loanType} Loan</h3>
            <span className={`px-2 py-1 text-xs rounded-full ${loan.myGuarantorStatus === 'approved' ? 'bg-green-100 text-green-700' : loan.myGuarantorStatus === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {loan.myGuarantorStatus === 'pending' ? 'Awaiting' : loan.myGuarantorStatus}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div><p className="text-gray-500">Amount</p><p className="font-semibold">{formatCurrency(loan.amount)}</p></div>
            <div><p className="text-gray-500">Interest</p><p className="font-semibold">{loan.interestRate}%</p></div>
            <div><p className="text-gray-500">Duration</p><p className="font-semibold">{loan.repaymentSchedule}m</p></div>
          </div>
        </div>
        {loan.myGuarantorStatus === 'pending' && (
          <div className="flex gap-2">
            <button onClick={() => onRespond(loan._id, 'approve')} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <CheckCircle size={18} />Approve
            </button>
            <button onClick={() => onRespond(loan._id, 'reject')} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              <XCircle size={18} />Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin loan card ──────────────────────────────────────────────────────────
function AdminLoanCard({ loan, isActive, onView, onEdit, onDelete, onApprove, onReject, onAddPayment, formatCurrency, formatDate, getStatusBadge }) {
  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-semibold text-lg">{loan.userName} - {loan.loanType}</h3>
            {getStatusBadge(loan.status)}
            {loan.appliedByAdmin && (
              <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">Admin Applied</span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-3">
            <div><p className="text-gray-500">Amount</p><p className="font-semibold">{formatCurrency(loan.amount)}</p></div>
            <div><p className="text-gray-500">Total Repayment</p><p className="font-semibold">{formatCurrency(loan.totalRepaymentAmount)}</p></div>
            <div><p className="text-gray-500">Remaining</p><p className="font-semibold text-red-600">{formatCurrency(loan.remainingBalance)}</p></div>
            <div><p className="text-gray-500">Progress</p><p className="font-semibold text-green-600">{loan.paymentProgress.toFixed(1)}%</p></div>
            <div><p className="text-gray-500">Applied</p><p className="font-semibold">{formatDate(loan.createdAt)}</p></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isActive && loan.remainingBalance > 0 && (
            <button onClick={onAddPayment} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <DollarSign size={18} />Add Payment
            </button>
          )}
          {!isActive && ['approved', 'pending'].includes(loan.status) && (
            <>
              <button onClick={() => onApprove(loan._id)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCircle size={18} />Grant
              </button>
              <button onClick={() => onReject(loan._id)} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <XCircle size={18} />Reject
              </button>
            </>
          )}
          {!isActive && (
            <>
              <button onClick={onEdit} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit size={18} /></button>
              <button onClick={() => onDelete(loan._id)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Delete"><Trash2 size={18} /></button>
            </>
          )}
          <button onClick={() => onView(loan)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg" title="View">
            <Eye size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Loan details modal ───────────────────────────────────────────────────────
function LoanDetailsModal({ loan, onClose, onEditPayment, onDeletePayment }) {
  const { isAdmin } = useAuth();
  const formatCurrency = (a) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(a);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 my-8">
        <h3 className="text-2xl font-semibold mb-6">Loan Details</h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold mb-3">Loan Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">Borrower</p><p className="font-semibold">{loan.userName}</p></div>
              <div><p className="text-gray-500">Type</p><p className="font-semibold">{loan.loanType}</p></div>
              <div><p className="text-gray-500">Amount</p><p className="font-semibold">{formatCurrency(loan.amount)}</p></div>
              <div><p className="text-gray-500">Interest</p><p className="font-semibold">{loan.interestRate}%</p></div>
              <div><p className="text-gray-500">Total</p><p className="font-semibold">{formatCurrency(loan.totalRepaymentAmount)}</p></div>
              <div><p className="text-gray-500">Remaining</p><p className="font-semibold text-red-600">{formatCurrency(loan.remainingBalance)}</p></div>
              <div><p className="text-gray-500">Schedule</p><p className="font-semibold">{loan.repaymentSchedule}m</p></div>
              <div><p className="text-gray-500">Status</p><p className="font-semibold capitalize">{loan.status}</p></div>
              <div><p className="text-gray-500">Applied</p><p className="font-semibold">{formatDate(loan.createdAt)}</p></div>
              <div><p className="text-gray-500">Approved</p><p className="font-semibold">{formatDate(loan.approvalDate)}</p></div>
              {loan.appliedByAdmin && (
                <div className="col-span-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">Applied by Admin</span>
                </div>
              )}
            </div>
          </div>

          {loan.guarantorsList && loan.guarantorsList.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3">
                Guarantors
                {loan.appliedByAdmin && <span className="ml-2 text-xs font-normal text-gray-500">(for record only)</span>}
              </h4>
              <div className="space-y-3">
                {loan.guarantorsList.map((g, i) => (
                  <div key={g.userId} className="border rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <div>
                        <p className="font-semibold">Guarantor {i + 1}: {g.name}</p>
                        <p className="text-sm text-gray-500">{g.email} • {g.phoneNumber}</p>
                      </div>
                      <span className={`px-3 py-1 text-sm rounded-full ${g.status === 'approved' ? 'bg-green-100 text-green-700' : g.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {g.status === 'approved' ? 'Approved' : g.status === 'rejected' ? 'Rejected' : 'Pending'}
                      </span>
                    </div>
                    {g.approvedAt && <p className="text-xs text-gray-500">Approved: {formatDate(g.approvedAt)}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold mb-2">Progress</h4>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div className="bg-blue-600 h-4 rounded-full flex items-center justify-center text-xs text-white" style={{ width: `${loan.paymentProgress}%` }}>
                {loan.paymentProgress.toFixed(1)}%
              </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Paid: {formatCurrency(loan.totalRepaymentAmount - loan.remainingBalance)}</span>
              <span>Remaining: {formatCurrency(loan.remainingBalance)}</span>
            </div>
          </div>

          {loan.paymentHistory && loan.paymentHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-3">Payment History</h4>
              <div className="border rounded-lg overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs">Date</th>
                        <th className="px-4 py-2 text-right text-xs">Paid</th>
                        <th className="px-4 py-2 text-right text-xs">Balance After</th>
                        <th className="px-4 py-2 text-left text-xs">Notes</th>
                        {isAdmin && <th className="px-4 py-2 text-center text-xs">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {loan.paymentHistory.map(p => (
                        <tr key={p._id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                          <td className="px-4 py-2 text-right font-semibold text-green-600">{formatCurrency(p.amountPaid)}</td>
                          <td className="px-4 py-2 text-right text-red-600">{formatCurrency(p.remainingBalance)}</td>
                          <td className="px-4 py-2 text-gray-600">{p.notes || '-'}</td>
                          {isAdmin && (
                            <td className="px-4 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => onEditPayment(p)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit"><Edit size={16} /></button>
                                <button onClick={() => onDeletePayment(p._id)} className="p-1 text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end pt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── NEW: Admin apply loan for member modal ───────────────────────────────────
function AdminApplyLoanModal({ onClose, onSuccess, members }) {
  const [formData, setFormData] = useState({
    userId: '',
    loanType: 'General',
    amount: '',
    interestRate: '10',
    repaymentSchedule: '12',
    applicationDate: new Date().toISOString().split('T')[0],
    purpose: '',
    guarantor1Id: '',
    guarantor2Id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.userId) {
      setError('Please select a member');
      return;
    }
    setLoading(true);
    try {
      await api.post('/loans/admin-apply', {
        ...formData,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate),
        repaymentSchedule: parseInt(formData.repaymentSchedule),
        applicationDate: new Date(formData.applicationDate).toISOString(),
        guarantor1Id: formData.guarantor1Id || null,
        guarantor2Id: formData.guarantor2Id || null,
      });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to apply loan');
    } finally {
      setLoading(false);
    }
  };

  // Exclude selected borrower from guarantor options
  const guarantorOptions = members.filter(m => m._id !== formData.userId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 rounded-lg"><UserPlus className="w-5 h-5 text-green-600" /></div>
          <div>
            <h3 className="text-2xl font-semibold">Apply Loan for Member</h3>
            <p className="text-sm text-gray-500">Loan will be granted immediately. No guarantor approval required.</p>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Borrower selection */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <label className="block text-sm font-medium mb-2 text-blue-900">Select Member (Borrower) <span className="text-red-500">*</span></label>
            <select
              value={formData.userId}
              onChange={(e) => setFormData({ ...formData, userId: e.target.value, guarantor1Id: '', guarantor2Id: '' })}
              className="w-full px-4 py-2 border border-blue-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- Select a member --</option>
              {members.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Loan Type</label>
              <select value={formData.loanType} onChange={(e) => setFormData({ ...formData, loanType: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required>
                <option value="General">General</option>
                <option value="Equipment">Equipment</option>
                <option value="Executive">Executive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount (₦)</label>
              <input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="1000" step="1000" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Interest (%)</label>
              <input type="number" value={formData.interestRate} onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="0" step="0.1" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Period (months)</label>
              <input type="number" value={formData.repaymentSchedule} onChange={(e) => setFormData({ ...formData, repaymentSchedule: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="1" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Application Date</label>
              <input type="date" value={formData.applicationDate} onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              <p className="text-xs text-gray-500 mt-1">Backdate to set past application date</p>
            </div>
          </div>

          {/* Guarantors — optional, for record only */}
          <div className="border border-dashed border-gray-300 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">
              Guarantors <span className="text-xs font-normal text-gray-500 ml-1">(optional — stored for record, no approval required)</span>
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Guarantor 1</label>
                <select
                  value={formData.guarantor1Id}
                  onChange={(e) => setFormData({ ...formData, guarantor1Id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">None</option>
                  {guarantorOptions.map(m => (
                    <option key={m._id} value={m._id} disabled={m._id === formData.guarantor2Id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Guarantor 2</label>
                <select
                  value={formData.guarantor2Id}
                  onChange={(e) => setFormData({ ...formData, guarantor2Id: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="">None</option>
                  {guarantorOptions.map(m => (
                    <option key={m._id} value={m._id} disabled={m._id === formData.guarantor1Id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Purpose</label>
            <textarea value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="3" />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
              <CheckCircle size={18} />
              {loading ? 'Granting...' : 'Grant Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Payment modal ────────────────────────────────────────────────────────────
function PaymentModal({ loan, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(`/loans/${loan._id}/payment`, {
        amount: parseFloat(amount),
        paymentDate: new Date(paymentDate).toISOString(),
        notes
      });
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (a) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(a);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold mb-4">Record Payment</h3>
        <div className="mb-4 space-y-2">
          <div className="p-3 bg-blue-50 rounded-lg"><p className="text-sm text-gray-600">Borrower</p><p className="font-semibold">{loan.userName}</p></div>
          <div className="p-3 bg-red-50 rounded-lg"><p className="text-sm text-gray-600">Remaining</p><p className="text-xl font-bold text-red-600">{formatCurrency(loan.remainingBalance)}</p></div>
        </div>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-2">Amount (₦)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required min="1" step="0.01" /></div>
          <div>
            <label className="block text-sm font-medium mb-2">Payment Date</label>
            <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required />
            <p className="text-xs text-gray-500 mt-1">Backdate if needed</p>
          </div>
          <div><label className="block text-sm font-medium mb-2">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2 border rounded-lg" rows="3" /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Recording...' : 'Record'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit loan modal ──────────────────────────────────────────────────────────
function EditLoanModal({ loan, onClose, onSave }) {
  const [formData, setFormData] = useState({
    loanType: loan.loanType,
    amount: loan.amount,
    interestRate: loan.interestRate,
    repaymentSchedule: loan.repaymentSchedule,
    purpose: loan.purpose || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(loan._id, {
      ...formData,
      amount: parseFloat(formData.amount),
      interestRate: parseFloat(formData.interestRate),
      repaymentSchedule: parseInt(formData.repaymentSchedule)
    });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold mb-4">Edit Loan</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-2">Type</label><select value={formData.loanType} onChange={(e) => setFormData({ ...formData, loanType: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required><option value="General">General</option><option value="Equipment">Equipment</option><option value="Executive">Executive</option></select></div>
          <div><label className="block text-sm font-medium mb-2">Amount (₦)</label><input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="1000" step="1000" /></div>
          <div><label className="block text-sm font-medium mb-2">Interest (%)</label><input type="number" value={formData.interestRate} onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="0" step="0.1" /></div>
          <div><label className="block text-sm font-medium mb-2">Period (months)</label><input type="number" value={formData.repaymentSchedule} onChange={(e) => setFormData({ ...formData, repaymentSchedule: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="1" /></div>
          <div><label className="block text-sm font-medium mb-2">Purpose</label><textarea value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="3" /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit payment modal ───────────────────────────────────────────────────────
function EditPaymentModal({ payment, onClose, onSave }) {
  const [amount, setAmount] = useState(payment.amountPaid.toString());
  const [paymentDate, setPaymentDate] = useState(payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : '');
  const [notes, setNotes] = useState(payment.notes || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSave(payment._id, amount, paymentDate, notes);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-semibold mb-4">Edit Payment</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-2">Amount (₦)</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required min="1" step="0.01" /></div>
          <div><label className="block text-sm font-medium mb-2">Date</label><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" required /></div>
          <div><label className="block text-sm font-medium mb-2">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2 border rounded-lg" rows="3" /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Member self-apply modal ──────────────────────────────────────────────────
function ApplyLoanModal({ onClose, onSuccess, users, currentUser }) {
  const [formData, setFormData] = useState({
    loanType: 'General',
    amount: '',
    interestRate: '10',
    repaymentSchedule: '12',
    applicationDate: new Date().toISOString().split('T')[0],
    purpose: '',
    guarantor1Id: '',
    guarantor2Id: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/loans', {
        ...formData,
        amount: parseFloat(formData.amount),
        interestRate: parseFloat(formData.interestRate),
        repaymentSchedule: parseInt(formData.repaymentSchedule),
        applicationDate: new Date(formData.applicationDate).toISOString()
      });
      onSuccess();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const availableGuarantors = users.filter(u => u._id !== currentUser._id);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 my-8">
        <h3 className="text-2xl font-semibold mb-6">Apply for Loan</h3>
        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select value={formData.loanType} onChange={(e) => setFormData({ ...formData, loanType: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required>
                <option value="General">General</option>
                <option value="Equipment">Equipment</option>
                {(currentUser.role === 'executive' || currentUser.role === 'admin') && <option value="Executive">Executive</option>}
              </select>
            </div>
            <div><label className="block text-sm font-medium mb-2">Amount (₦)</label><input type="number" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="1000" step="1000" /></div>
            <div><label className="block text-sm font-medium mb-2">Interest (%)</label><input type="number" value={formData.interestRate} onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="0" step="0.1" /></div>
            <div><label className="block text-sm font-medium mb-2">Period (months)</label><input type="number" value={formData.repaymentSchedule} onChange={(e) => setFormData({ ...formData, repaymentSchedule: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required min="1" /></div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Application Date</label>
              <input type="date" value={formData.applicationDate} onChange={(e) => setFormData({ ...formData, applicationDate: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required />
              <p className="text-xs text-gray-500 mt-1">Backdate to set past application date</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Guarantor 1</label>
              <select value={formData.guarantor1Id} onChange={(e) => setFormData({ ...formData, guarantor1Id: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required>
                <option value="">Select</option>
                {availableGuarantors.map(u => (
                  <option key={u._id} value={u._id} disabled={u._id === formData.guarantor2Id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Guarantor 2</label>
              <select value={formData.guarantor2Id} onChange={(e) => setFormData({ ...formData, guarantor2Id: e.target.value })} className="w-full px-4 py-2 border rounded-lg" required>
                <option value="">Select</option>
                {availableGuarantors.map(u => (
                  <option key={u._id} value={u._id} disabled={u._id === formData.guarantor1Id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div><label className="block text-sm font-medium mb-2">Purpose</label><textarea value={formData.purpose} onChange={(e) => setFormData({ ...formData, purpose: e.target.value })} className="w-full px-4 py-2 border rounded-lg" rows="3" /></div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">{loading ? 'Submitting...' : 'Apply'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}