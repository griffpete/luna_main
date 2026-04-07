import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { GitCommit, GitPullRequest, Users, Activity, Clock } from "lucide-react";
import { useRepo } from "../context/RepoContext";

type KpiData = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: typeof GitCommit;
};

type CommitData = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
  type: string;
};

export function Dashboard() {
  const { owner, repo, apiBase } = useRepo();
  const [activeTab, setActiveTab] = useState("30 Days");
  const [kpis, setKpis] = useState<KpiData[]>([]);
  const [historyData, setHistoryData] = useState<{ name: string; commits: number; additions: number; deletions: number }[]>([]);
  const [recentCommits, setRecentCommits] = useState<CommitData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, activityRes, commitsRes] = await Promise.all([
          fetch(`${apiBase}/stats?owner=${owner}&repo=${repo}`),
          fetch(`${apiBase}/activity?owner=${owner}&repo=${repo}&months=6`),
          fetch(`${apiBase}/commits?owner=${owner}&repo=${repo}&limit=10`)
        ]);

        const stats = await statsRes.json();
        const activity = await activityRes.json();
        const commits = await commitsRes.json();

        const formatNumber = (n?: number) => n ? (n > 999 ? `${(n / 1000).toFixed(1)}k` : n.toString()) : '—';

        setKpis([
          { label: "Total Commits (30d)", value: formatNumber(stats.totalCommits30d), change: "—", positive: true, icon: GitCommit },
          { label: "Active Contributors", value: formatNumber(stats.activeContributors), change: "—", positive: true, icon: Users },
          { label: "Open Pull Requests", value: formatNumber(stats.openPullRequests), change: "—", positive: true, icon: GitPullRequest },
        ]);

        setHistoryData(activity.activity || []);
        setRecentCommits(commits.commits || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setKpis([
          { label: "Total Commits (30d)", value: "—", change: "—", positive: true, icon: GitCommit },
          { label: "Active Contributors", value: "—", change: "—", positive: true, icon: Users },
          { label: "Open Pull Requests", value: "—", change: "—", positive: true, icon: GitPullRequest },
        ]);
        setHistoryData([]);
        setRecentCommits([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [owner, repo, apiBase]);

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} mins ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="p-8 space-y-8 text-slate-100">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Repository Overview</h2>
        <div className="flex bg-slate-800 rounded-lg p-1">
          {["7 Days", "30 Days", "All Time"].map((tab) => (
            <button
              key={tab}
              className="px-4 py-1.5 text-sm rounded-md hover:bg-slate-700 text-slate-300 transition-colors focus:bg-indigo-500/20 focus:text-indigo-300"
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <div className="mt-4 flex items-center text-sm">
              <span className={kpi.positive ? "text-emerald-400" : "text-rose-400"}>
                {kpi.change}
              </span>
              <span className="text-slate-500 ml-2">vs last period</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Code Activity Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Code Volume Over Time</h3>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Lines Add/Del</span>
          </div>
          <div className="h-72">
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
          </div>
        </div>

        {/* Commit History Graph */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Commit Frequency</h3>
            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">Commits</span>
          </div>
          <div className="h-72">
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
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            Recent Changes
          </h3>
          <button className="text-sm text-indigo-400 hover:text-indigo-300">View All Commits →</button>
        </div>
        
        <div className="space-y-4">
          {recentCommits.map((commit) => (
            <div key={commit.sha} className="flex items-start gap-4 p-4 rounded-lg bg-slate-950/50 border border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <div className="mt-1">
                <GitCommit className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{commit.sha}</span>
                  <p className="text-sm font-medium text-slate-200">{commit.message}</p>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white">
                      {commit.author.charAt(0)}
                    </div>
                    {commit.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(commit.date)}
                  </span>
                </div>
              </div>
              <div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  commit.type === 'feat' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  commit.type === 'fix' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  commit.type === 'refactor' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  {commit.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
