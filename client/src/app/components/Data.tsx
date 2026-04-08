import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { GitCommit, GitPullRequest, Users, Activity } from "lucide-react";
import { useRepo } from "../context/RepoContext";

type KpiData = {
  label: string;
  value: string;
  icon: typeof GitCommit;
};

export function Data() {
  const { owner, repo, apiBase } = useRepo();
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [historyData, setHistoryData] = useState<{ name: string; commits: number; additions: number; deletions: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const months = timeRange === '7' ? 1 : timeRange === '30' ? 2 : 4;
        
        const [statsRes, activityRes] = await Promise.all([
          fetch(`${apiBase}/stats?owner=${owner}&repo=${repo}`),
          fetch(`${apiBase}/activity?owner=${owner}&repo=${repo}&months=${months}`)
        ]);

        const stats = await statsRes.json();
        const activity = await activityRes.json();

        const formatNumber = (n?: number) => n ? (n > 999 ? `${(n / 1000).toFixed(1)}k` : n.toString()) : '—';

        setKpis([
          { label: "Total Commits", value: formatNumber(stats.totalCommits30d), icon: GitCommit },
          { label: "Active Contributors", value: formatNumber(stats.activeContributors), icon: Users },
          { label: "Open Pull Requests", value: formatNumber(stats.openPullRequests), icon: GitPullRequest },
          { label: "Total Changes", value: formatNumber(stats.totalAdditions + stats.totalDeletions), icon: Activity },
        ]);

        setHistoryData(activity.activity || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [owner, repo, apiBase, timeRange]);

  return (
    <div className="p-8 space-y-8 text-slate-100">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Repository Data</h2>
        <div className="flex bg-slate-800 rounded-lg p-1">
          {(['7', '30', '90'] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                timeRange === days
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'hover:bg-slate-700 text-slate-300'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400">{kpi.label}</p>
                <h3 className="text-3xl font-bold mt-2 text-white">{kpi.value}</h3>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                <kpi.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Activity Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Code Changes Over Time</h3>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Lines Added / Deleted</span>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-500">Loading...</div>
            ) : historyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorAdd" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                  <Area type="monotone" dataKey="additions" stroke="#10b981" fillOpacity={1} fill="url(#colorAdd)" name="Additions" />
                  <Area type="monotone" dataKey="deletions" stroke="#f43f5e" fillOpacity={1} fill="url(#colorDel)" name="Deletions" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Commit Frequency Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Commit Frequency</h3>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Commits per Period</span>
          </div>
          <div className="h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-500">Loading...</div>
            ) : historyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={historyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: '#1e293b' }}
                    contentStyle={{ backgroundColor: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px" }}
                  />
                  <Bar dataKey="commits" fill="#6366f1" radius={[4, 4, 0, 0]} name="Commits" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
