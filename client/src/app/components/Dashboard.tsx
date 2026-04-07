import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar, Legend } from "recharts";
import { GitCommit, GitPullRequest, Users, Activity, Clock } from "lucide-react";

const HISTORY_DATA = [
  { name: "Jan", commits: 400, additions: 2400, deletions: 1200 },
  { name: "Feb", commits: 300, additions: 1398, deletions: 800 },
  { name: "Mar", commits: 200, additions: 9800, deletions: 4200 },
  { name: "Apr", commits: 278, additions: 3908, deletions: 1800 },
  { name: "May", commits: 189, additions: 4800, deletions: 2100 },
  { name: "Jun", commits: 239, additions: 3800, deletions: 1500 },
  { name: "Jul", commits: 349, additions: 4300, deletions: 1900 },
];

const RECENT_CHANGES = [
  { id: "1a2b3c4d", message: "feat: add user authentication flow", author: "Alex R.", time: "10 mins ago", type: "feat" },
  { id: "5e6f7g8h", message: "fix: resolve memory leak in canvas", author: "Sarah T.", time: "45 mins ago", type: "fix" },
  { id: "9i0j1k2l", message: "refactor: cleanup unused components", author: "Mike L.", time: "2 hours ago", type: "refactor" },
  { id: "3m4n5o6p", message: "docs: update README with setup instructions", author: "Alex R.", time: "4 hours ago", type: "docs" },
  { id: "7q8r9s0t", message: "chore: update dependencies", author: "Jenkins Bot", time: "6 hours ago", type: "chore" },
];

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("all");

  const kpis = [
    { label: "Total Commits (30d)", value: "2,341", change: "+12.5%", positive: true, icon: GitCommit },
    { label: "Active Contributors", value: "14", change: "+2", positive: true, icon: Users },
    { label: "Open Pull Requests", value: "32", change: "-5", positive: true, icon: GitPullRequest },
  ];

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
              <AreaChart data={HISTORY_DATA}>
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
              <BarChart data={HISTORY_DATA}>
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
          {RECENT_CHANGES.map((change) => (
            <div key={change.id} className="flex items-start gap-4 p-4 rounded-lg bg-slate-950/50 border border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <div className="mt-1">
                <GitCommit className="w-5 h-5 text-slate-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{change.id}</span>
                  <p className="text-sm font-medium text-slate-200">{change.message}</p>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white">
                      {change.author.charAt(0)}
                    </div>
                    {change.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {change.time}
                  </span>
                </div>
              </div>
              <div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                  change.type === 'feat' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  change.type === 'fix' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  change.type === 'refactor' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                }`}>
                  {change.type}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
