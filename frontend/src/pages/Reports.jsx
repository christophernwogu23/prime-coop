import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
import { FileText, Download, Calendar, Users, Wallet, PiggyBank, TrendingUp, ClipboardList, DollarSign } from 'lucide-react';

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loanStatus, setLoanStatus] = useState('');

  const reports = [
    {
      id: 'loans',
      title: 'Loans Report',
      description: 'All loans with amounts, balances, and status',
      icon: Wallet,
      color: 'bg-blue-500',
      hasDateFilter: true,
      hasStatusFilter: true
    },
    {
      id: 'payments',
      title: 'Payments Report',
      description: 'Complete payment history for all loans',
      icon: DollarSign,
      color: 'bg-green-500',
      hasDateFilter: true,
      hasStatusFilter: false
    },
    {
      id: 'savings',
      title: 'Savings Report',
      description: 'Member savings balances and accounts',
      icon: PiggyBank,
      color: 'bg-purple-500',
      hasDateFilter: false,
      hasStatusFilter: false
    },
    {
      id: 'members',
      title: 'Members Report',
      description: 'Complete member list with contact details',
      icon: Users,
      color: 'bg-yellow-500',
      hasDateFilter: false,
      hasStatusFilter: false
    },
    {
      id: 'dividends',
      title: 'Dividends Report',
      description: 'Profit distributions and payments',
      icon: TrendingUp,
      color: 'bg-red-500',
      hasDateFilter: false,
      hasStatusFilter: false
    },
    {
      id: 'attendance',
      title: 'Attendance Report',
      description: 'Meeting attendance records and statistics',
      icon: ClipboardList,
      color: 'bg-indigo-500',
      hasDateFilter: true,
      hasStatusFilter: false
    }
  ];

  const downloadReport = async (reportType) => {
    setLoading(true);
    
    try {
      let url = `/api/reports/${reportType}`;
      const params = new URLSearchParams();
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (loanStatus && reportType === 'loans') params.append('status', loanStatus);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      // Make sure token is included
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:8000${url}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      // Get the blob
      const blob = await response.blob();
      
      // Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      
      setSelectedReport(null);
      setStartDate('');
      setEndDate('');
      setLoanStatus('');
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Generate and download reports in Excel format</p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report) => {
          const Icon = report.icon;
          return (
            <div
              key={report.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedReport(report)}
            >
              <div className={`w-12 h-12 ${report.color} rounded-lg flex items-center justify-center mb-4`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="font-semibold text-lg text-gray-900 mb-2">{report.title}</h3>
              <p className="text-sm text-gray-500">{report.description}</p>
              <button className="mt-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm">
                <Download size={16} />
                Generate Report
              </button>
            </div>
          );
        })}
      </div>

      {/* Report Generation Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Generate {selectedReport.title}
            </h3>
            
            <p className="text-sm text-gray-600 mb-6">{selectedReport.description}</p>

            <div className="space-y-4">
              {selectedReport.hasDateFilter && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {selectedReport.hasStatusFilter && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Loan Status (Optional)
                  </label>
                  <select
                    value={loanStatus}
                    onChange={(e) => setLoanStatus(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="granted">Active (Granted)</option>
                    <option value="approved">Pending Admin</option>
                    <option value="guarantor_approval">Pending Guarantors</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-6">
              <button
                type="button"
                onClick={() => {
                  setSelectedReport(null);
                  setStartDate('');
                  setEndDate('');
                  setLoanStatus('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => downloadReport(selectedReport.id)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download size={18} />
                {loading ? 'Generating...' : 'Download Excel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}