import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  BarChart3, Activity, Zap, Compass, RefreshCw, Calendar, Cpu, User, Clock, CheckCircle2, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { AnalyticsDashboard, QueryLog } from '../types';

export const Dashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [logs, setLogs] = useState<QueryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setError(null);
    try {
      const analyticsRes = await api.chat.getAnalytics();
      setAnalytics(analyticsRes);
      
      const logsRes = await api.chat.getQueryLogs();
      setLogs(logsRes);
    } catch (err: any) {
      setError("Failed to fetch administrative metrics from system database.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-slate-400 text-xs">
        Compiling administrative analytical reports...
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg flex items-center space-x-2">
            <ShieldCheck size={20} className="text-indigo-500" />
            <span>AI Operations & Query Auditing</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Real-time system health, LLM latency, and similarity confidence tracking.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-2 transition shadow-3xs"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl text-red-700 dark:text-red-400 text-xs font-semibold leading-relaxed">
          {error}
        </div>
      )}

      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-3xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Queries Answered</span>
              <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                <Activity size={18} />
              </span>
            </div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{analytics.total_queries}</h4>
            <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-2 flex items-center space-x-1">
              <CheckCircle2 size={12} />
              <span>All systems active</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-3xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Average RAG Confidence</span>
              <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Compass size={18} />
              </span>
            </div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {Math.round(analytics.avg_confidence * 100)}%
            </h4>
            <div className="text-[10px] text-slate-400 font-medium mt-2">
              Mean vector space cosine similarity score.
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-3xs">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Average Generation Latency</span>
              <span className="p-2.5 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
                <Zap size={18} />
              </span>
            </div>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
              {analytics.avg_latency_ms} <span className="text-xs font-bold text-slate-400">ms</span>
            </h4>
            <div className="text-[10px] text-slate-400 font-medium mt-2">
              Includes vector lookups & remote model completions.
            </div>
          </div>
        </div>
      )}

      {analytics && analytics.total_queries > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 lg:col-span-2 shadow-xs">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center space-x-2 mb-6">
              <Calendar size={14} className="text-indigo-500" />
              <span>Query Volume Distribution (Last 7 Days)</span>
            </h4>
            {analytics.daily_query_volume.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">No traffic logged this week.</div>
            ) : (
              <div className="space-y-4">
                {analytics.daily_query_volume.map((vol, idx) => (
                  <div key={idx} className="flex items-center space-x-3">
                    <span className="text-[10px] font-bold text-slate-500 w-24 shrink-0">{vol.date}</span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (vol.count / Math.max(...analytics.daily_query_volume.map(v => v.count), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 w-8 text-right">{vol.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
            <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center space-x-2 mb-6">
              <Cpu size={14} className="text-indigo-500" />
              <span>Configured LLM Engines Allocation</span>
            </h4>
            <div className="space-y-4">
              {Object.entries(analytics.provider_distribution).map(([provider, count], idx) => {
                const percentage = Math.round((count / analytics.total_queries) * 100);
                return (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-200 capitalize">
                      <span>{provider} API</span>
                      <span className="text-indigo-600 dark:text-indigo-400">{percentage}%</span>
                    </div>
                    <div className="mt-2.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="bg-indigo-600 dark:bg-indigo-400 h-full rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">{count} completed requests logged.</p>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center space-x-2">
            <BarChart3 size={16} className="text-indigo-500" />
            <span>Centralized Query Audit Trail</span>
          </h3>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No queries have been completed yet on this workspace instance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-6 py-3.5 w-32">User</th>
                  <th className="px-6 py-3.5">Query Input</th>
                  <th className="px-6 py-3.5">AI Response</th>
                  <th className="px-6 py-3.5 text-center">Confidence</th>
                  <th className="px-6 py-3.5 text-center">Latency</th>
                  <th className="px-6 py-3.5">Provider</th>
                  <th className="px-6 py-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs text-slate-600 dark:text-slate-300">
                {logs.map((log) => {
                  const isUnknown = log.response_text === "I don't know.";
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">
                        <div className="flex items-center space-x-1.5">
                          <User size={12} className="text-slate-400" />
                          <span>{log.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={log.query_text}>
                        {log.query_text}
                      </td>
                      <td className="px-6 py-4 truncate max-w-[260px]" title={log.response_text}>
                        {isUnknown ? (
                          <span className="text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-sm flex items-center space-x-1.5 w-fit">
                            <AlertTriangle size={11} /> <span>{log.response_text}</span>
                          </span>
                        ) : (
                          <span>{log.response_text}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 dark:text-slate-200">
                        {log.confidence_score !== undefined && log.confidence_score !== null ? `${Math.round(log.confidence_score * 100)}%` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center space-x-0.5">
                        <Clock size={11} className="text-slate-400 mr-1" />
                        <span>{log.latency_ms} ms</span>
                      </td>
                      <td className="px-6 py-4 capitalize font-semibold text-slate-500">{log.llm_provider}</td>
                      <td className="px-6 py-4 font-medium text-slate-400 text-[10px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
export default Dashboard;
