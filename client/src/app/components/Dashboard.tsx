import { useState, useEffect } from "react";
import { GitCommit, Activity, Clock, Sparkles } from "lucide-react";
import { useRepo } from "../context/RepoContext";

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
  const [recentCommits, setRecentCommits] = useState<CommitData[]>([]);
  const [description, setDescription] = useState<string>('');
  const [recentHistory, setRecentHistory] = useState<string>('');
  const [direction, setDirection] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      console.log('Dashboard: fetching data...');
      setLoading(true);
      try {
        const overviewRes = await fetch(`${apiBase}/structure/overview?owner=${owner}&repo=${repo}`);
        console.log('Overview response status:', overviewRes.status);
        const overviewData = await overviewRes.json();
        console.log('Overview data received:', overviewData);
        
        setDescription(overviewData.description || '');
        setRecentHistory(overviewData.recentHistory || '');
        setDirection(overviewData.direction || '');
        
        const commitsRes = await fetch(`${apiBase}/commits?owner=${owner}&repo=${repo}&limit=10`);
        const commits = await commitsRes.json();
        setRecentCommits(commits.commits || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setLoading(false);
        console.log('Dashboard: loading complete');
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Repository Overview</h2>
        <p className="text-slate-400 mt-1">Insights for {owner}/{repo}</p>
      </div>

      {/* AI Generated Overview */}
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Project Description
          </h3>
          <p className="text-slate-300 leading-relaxed">{description || 'Click the refresh button to generate project insights.'}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Recent Activity
            </h3>
            {recentHistory ? (
              <ul className="space-y-2 text-sm text-slate-300">
                {recentHistory.split(/[\n]|","|","/).filter(s => s.trim()).slice(0, 5).map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">•</span>
                    <span>{point.replace(/^[-"'\[\]• ]+/, '').replace(/["'\[\]]+$/, '').trim()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Click the refresh button to generate recent activity summary.</p>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Project Trajectory
            </h3>
            {direction ? (
              <ul className="space-y-2 text-sm text-slate-300">
                {direction.split(/[\n]|","|","/).filter(s => s.trim()).slice(0, 5).map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-1">•</span>
                    <span>{point.replace(/^[-"'\[\]• ]+/, '').replace(/["'\[\]]+$/, '').trim()}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-sm">Click the refresh button to generate project trajectory.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Commits */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <GitCommit className="w-5 h-5 text-indigo-400" />
            Recent Changes
          </h3>
        </div>
        
        <div className="space-y-4">
          {loading ? (
            <p className="text-slate-500 text-center py-8">Loading...</p>
          ) : recentCommits.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No commits found</p>
          ) : (
            recentCommits.map((commit) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
