import { Outlet, NavLink } from "react-router";
import { Activity, LayoutDashboard, MessageSquare, Moon, Code2, Settings, ChevronDown, Loader2, Layers, BarChart3, RefreshCw, Star } from "lucide-react";
import { useRepo } from "../context/RepoContext";
import { useSettings } from "../context/SettingsContext";
import { useState, useEffect, useRef } from "react";

type Repo = {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  url: string;
};

export function Layout() {
  const { owner, repo, apiBase, setRepo } = useRepo();
  const { settings } = useSettings();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [needsAnalysis, setNeedsAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const checkAnalysisStatus = async (targetOwner: string, targetRepo: string) => {
    try {
      const res = await fetch(`${apiBase}/structure/status?owner=${targetOwner}&repo=${targetRepo}`);
      const data = await res.json();
      setNeedsAnalysis(data.needsAnalysis);
    } catch (err) {
      console.error('Failed to check analysis status:', err);
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await fetch(`${apiBase}/structure/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, forceReindex: true, technicalLevel: settings.technicalLevel })
      });
      setNeedsAnalysis(false);
      window.location.reload();
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRefreshOverview = async () => {
    setIsAnalyzing(true);
    try {
      await fetch(`${apiBase}/structure/refresh-overview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, technicalLevel: settings.technicalLevel })
      });
      window.location.reload();
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    checkAnalysisStatus(owner, repo);
  }, [owner, repo, apiBase]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchRepos() {
      try {
        const [reposRes, favRes] = await Promise.all([
          fetch(`${apiBase}/repos`),
          fetch(`${apiBase}/favorites`)
        ]);
        const reposData = await reposRes.json();
        const favData = await favRes.json();
        setRepos(reposData.repos || []);
        setFavorites(new Set(favData.favorites || []));
      } catch (err) {
        console.error('Failed to fetch repos:', err);
      } finally {
        setLoadingRepos(false);
      }
    }
    fetchRepos();
  }, [apiBase]);

  const handleSelectRepo = (selectedRepo: Repo) => {
    const [newOwner, newName] = selectedRepo.fullName.split('/');
    setRepo(newOwner, newName);
    setShowDropdown(false);
  };

  const toggleFavorite = async (e: React.MouseEvent, repoName: string) => {
    e.stopPropagation();
    const fullName = repoName;
    const isFavorite = favorites.has(fullName);

    try {
      if (isFavorite) {
        await fetch(`${apiBase}/favorites`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: fullName })
        });
        setFavorites(prev => {
          const next = new Set(prev);
          next.delete(fullName);
          return next;
        });
      } else {
        await fetch(`${apiBase}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: fullName })
        });
        setFavorites(prev => new Set(prev).add(fullName));
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const fetchFavorites = async () => {
    try {
      const res = await fetch(`${apiBase}/favorites`);
      const data = await res.json();
      setFavorites(new Set(data.favorites || []));
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
    }
  };

  const navItems = [
    { name: "Overview", path: "/", icon: Activity },
    { name: "Data", path: "/data", icon: BarChart3 },
    { name: "Structure", path: "/structure", icon: LayoutDashboard },
    { name: "Luna AI Chat", path: "/chat", icon: MessageSquare },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
            <Moon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Luna</h1>
            <p className="text-xs text-slate-400">Codebase Insights</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <div className="mb-4 px-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Views
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`
            }
          >
            <Settings className="w-5 h-5" />
            Settings
          </NavLink>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 bg-slate-950/50 flex items-center px-8 justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Code2 className="w-4 h-4" />
            <span>Repository: </span>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={loadingRepos}
                className="flex items-center gap-2 text-slate-200 font-medium hover:text-white transition-colors disabled:opacity-50"
              >
                {owner}/{repo}
                {loadingRepos ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
              {showDropdown && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                  {(() => {
                    const sortedRepos = [...repos].sort((a, b) => {
                      const aFav = favorites.has(a.fullName);
                      const bFav = favorites.has(b.fullName);
                      if (aFav && !bFav) return -1;
                      if (!aFav && bFav) return 1;
                      return a.name.localeCompare(b.name);
                    });
                    const favoriteRepos = sortedRepos.filter(r => favorites.has(r.fullName));
                    const otherRepos = sortedRepos.filter(r => !favorites.has(r.fullName));
                    return (
                      <>
                        {favoriteRepos.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                              Favorites
                            </div>
                            {favoriteRepos.map((r) => (
                              <button
                                key={r.fullName}
                                onClick={() => handleSelectRepo(r)}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 ${
                                  r.fullName === `${owner}/${repo}` ? 'bg-indigo-500/10' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-200 font-medium">{r.name}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => toggleFavorite(e, r.fullName)}
                                      className="text-amber-400 hover:text-amber-300"
                                    >
                                      <Star className="w-4 h-4 fill-current" />
                                    </button>
                                    {r.private && (
                                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Private</span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 truncate">{r.description || 'No description'}</p>
                              </button>
                            ))}
                          </>
                        )}
                        {otherRepos.length > 0 && (
                          <>
                            <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                              {favoriteRepos.length > 0 ? 'Other Repositories' : 'Repositories'}
                            </div>
                            {otherRepos.map((r) => (
                              <button
                                key={r.fullName}
                                onClick={() => handleSelectRepo(r)}
                                className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-b-0 ${
                                  r.fullName === `${owner}/${repo}` ? 'bg-indigo-500/10' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-200 font-medium">{r.name}</span>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={(e) => toggleFavorite(e, r.fullName)}
                                      className="text-slate-500 hover:text-amber-400"
                                    >
                                      <Star className="w-4 h-4" />
                                    </button>
                                    {r.private && (
                                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">Private</span>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 truncate">{r.description || 'No description'}</p>
                              </button>
                            ))}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {needsAnalysis && (
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                {isAnalyzing ? 'Analyzing...' : 'Analyze Branch'}
              </button>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefreshOverview}
                disabled={isAnalyzing}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors disabled:opacity-50"
                title="Refresh Overview"
              >
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </button>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${needsAnalysis ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                <span className="text-sm text-slate-300">{needsAnalysis ? 'Needs Update' : 'Synced'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-auto bg-slate-950">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
