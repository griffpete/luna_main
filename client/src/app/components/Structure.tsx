import { useState, useEffect, useMemo, useCallback } from "react";
import { FileCode2, Package, GitBranch, ShieldAlert, Network, Loader2, RefreshCw, FolderTree, Boxes, ChevronRight, ChevronDown, File } from "lucide-react";
import { useRepo } from "../context/RepoContext";

// ---- Types ----

type NodeType = "core" | "hook" | "component" | "util" | "service" | "store";
type ViewMode = "files" | "architecture";

interface FileNode {
  id: string;
  label: string;
  type: NodeType;
  path: string;
  module: string;
  imports: string[];
  importedBy: string[];
}

interface FileEdge {
  source: string;
  target: string;
}

interface ModuleNode {
  id: string;
  label: string;
  fileCount: number;
}

interface ModuleEdge {
  source: string;
  target: string;
  weight: number;
}

interface MetricsData {
  totalFiles: number;
  codeFiles: number;
  complexity: number;
  codeSmells: { type: string; file: string; description: string; severity: string }[];
  lastAnalyzed: string | null;
}

interface OverviewData {
  topLanguages: { language: string; count: number }[];
}

interface AnalysisData {
  nodes: FileNode[];
  edges: FileEdge[];
  moduleNodes: ModuleNode[];
  moduleEdges: ModuleEdge[];
  dirTree: any;
  cyclomaticComplexity: number;
  codeSmells: { type: string; file: string; description: string; severity: string }[];
  totalFiles: number;
  codeFiles: number;
}

// ---- File Tree Component ----

function TreeNode({ name, data, depth, allNodes, selectedFile, onSelectFile }: {
  name: string;
  data: any;
  depth: number;
  allNodes: FileNode[];
  selectedFile: string | null;
  onSelectFile: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isFile = data._file;

  if (isFile) {
    const node = allNodes.find(n => n.id === data.id);
    const isSelected = selectedFile === data.id;
    const typeColor: Record<string, string> = {
      core: "text-blue-400",
      hook: "text-purple-400",
      component: "text-emerald-400",
      util: "text-amber-400",
      service: "text-rose-400",
      store: "text-cyan-400",
    };

    return (
      <div
        onClick={() => onSelectFile(isSelected ? null : data.id)}
        className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors text-sm ${
          isSelected ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <File className={`w-3.5 h-3.5 flex-shrink-0 ${typeColor[data.type] || 'text-slate-500'}`} />
        <span className="truncate">{name}</span>
        {node && (
          <span className="text-xs text-slate-500 ml-auto flex-shrink-0">
            {node.imports.length > 0 && <span className="mr-2">{node.imports.length}→</span>}
            {node.importedBy.length > 0 && <span>←{node.importedBy.length}</span>}
          </span>
        )}
      </div>
    );
  }

  const entries = Object.entries(data).sort(([aName, aData], [bName, bData]) => {
    const aIsFile = (aData as any)._file;
    const bIsFile = (bData as any)._file;
    if (aIsFile !== bIsFile) return aIsFile ? 1 : -1;
    return aName.localeCompare(bName);
  });

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 py-1 px-2 rounded cursor-pointer text-slate-200 hover:bg-slate-800 transition-colors text-sm font-medium"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
        <span>{name}</span>
        <span className="text-xs text-slate-500 ml-1">({entries.length})</span>
      </div>
      {expanded && entries.map(([childName, childData]) => (
        <TreeNode
          key={childName}
          name={childName}
          data={childData}
          depth={depth + 1}
          allNodes={allNodes}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}

// ---- Architecture Graph Component ----

const PLANET_COLORS = [
  { bg: 'bg-gradient-to-br from-blue-500 to-blue-700', name: 'blue' },
  { bg: 'bg-gradient-to-br from-emerald-500 to-emerald-700', name: 'emerald' },
  { bg: 'bg-gradient-to-br from-rose-500 to-rose-700', name: 'rose' },
  { bg: 'bg-gradient-to-br from-purple-500 to-purple-700', name: 'purple' },
  { bg: 'bg-gradient-to-br from-amber-500 to-amber-700', name: 'amber' },
  { bg: 'bg-gradient-to-br from-cyan-500 to-cyan-700', name: 'cyan' },
  { bg: 'bg-gradient-to-br from-pink-500 to-pink-700', name: 'pink' },
  { bg: 'bg-gradient-to-br from-violet-500 to-violet-700', name: 'violet' },
  { bg: 'bg-gradient-to-br from-teal-500 to-teal-700', name: 'teal' },
  { bg: 'bg-gradient-to-br from-orange-500 to-orange-700', name: 'orange' },
  { bg: 'bg-gradient-to-br from-indigo-500 to-indigo-700', name: 'indigo' },
  { bg: 'bg-gradient-to-br from-lime-500 to-lime-700', name: 'lime' },
];

function ArchitectureGraph({ 
  moduleNodes, 
  moduleEdges, 
  repoName,
  allNodes 
}: { 
  moduleNodes: ModuleNode[]; 
  moduleEdges: ModuleEdge[];
  repoName: string;
  allNodes?: FileNode[];
}) {
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [animationAngle, setAnimationAngle] = useState(0);

  // Animate the orbit slowly
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationAngle(prev => prev + 0.15);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Get files for a module
  const getModuleFiles = (modId: string): FileNode[] => {
    const mod = moduleNodes.find(m => m.id === modId);
    if (!mod || !allNodes) return [];
    return allNodes.filter(n => n.module === mod.label);
  };

  // Layout main planets orbiting the sun
  const mainPlanets = useMemo(() => {
    const count = moduleNodes.length;
    if (count === 0) return [];

    const sorted = [...moduleNodes].sort((a, b) => b.fileCount - a.fileCount);
    const baseRadius = count <= 3 ? 30 : count <= 6 ? 35 : 40;

    return sorted.map((mod, idx) => {
      const baseAngle = (idx / count) * 2 * Math.PI - Math.PI / 2;
      const angle = baseAngle + (animationAngle * 0.01);
      const radius = baseRadius + (mod.fileCount > 15 ? 5 : 0);
      return {
        ...mod,
        baseAngle,
        x: 50 + radius * Math.cos(angle),
        y: 50 + radius * Math.sin(angle),
        radius,
        colorIdx: idx % PLANET_COLORS.length,
        fileCount: getModuleFiles(mod.id).length,
      };
    });
  }, [moduleNodes, animationAngle, allNodes]);

  // Layout moons when a planet is selected
  const moonFiles = useMemo(() => {
    if (!selectedModule || !allNodes) return [];
    const files = getModuleFiles(selectedModule);
    if (files.length === 0) return [];

    const sorted = [...files].sort((a, b) => a.label.localeCompare(b.label));

    return sorted.map((file, idx) => {
      const orbitRadius = 18 + Math.min(idx * 3, 42);
      const angle = (idx / sorted.length) * 2 * Math.PI - Math.PI / 2 + (animationAngle * 0.015);
      return {
        ...file,
        x: 50 + orbitRadius * Math.cos(angle),
        y: 50 + orbitRadius * Math.sin(angle),
        orbitRadius,
      };
    });
  }, [selectedModule, allNodes, animationAngle]);

  const connectedModules = useMemo(() => {
    if (!hoveredModule) return new Set<string>();
    const connected = new Set<string>([hoveredModule]);
    moduleEdges.forEach(e => {
      if (e.source === hoveredModule) connected.add(e.target);
      if (e.target === hoveredModule) connected.add(e.source);
    });
    return connected;
  }, [hoveredModule, moduleEdges]);

  const handleModuleClick = (modId: string) => {
    setSelectedModule(prev => prev === modId ? null : modId);
  };

  const selectedPlanet = selectedModule ? mainPlanets.find(p => p.id === selectedModule) : null;
  const selectedColor = selectedPlanet ? PLANET_COLORS[selectedPlanet.colorIdx] : PLANET_COLORS[0];

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Central Sun / Selected Planet */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center pointer-events-auto">
        {selectedModule ? (
          // Selected planet becomes the new sun
          <div 
            className={`w-40 h-40 rounded-full ${selectedColor.bg} shadow-[0_0_50px_rgba(255,255,255,0.4),0_0_80px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center cursor-pointer`}
            onClick={() => setSelectedModule(null)}
          >
            <span className="text-white text-sm font-bold text-center px-3 leading-tight">{selectedPlanet?.label}</span>
            <span className="text-xs text-white/80 mt-1">{selectedPlanet?.fileCount} files</span>
            <span className="text-[10px] text-white/60 mt-2">(click to exit)</span>
          </div>
        ) : (
          // Original sun with repo name
          <>
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 shadow-[0_0_50px_rgba(251,146,60,0.6),0_0_80px_rgba(239,68,68,0.3)] flex flex-col items-center justify-center">
              <span className="text-white text-xs font-bold tracking-wider uppercase">Repo</span>
            </div>
            <div className="mt-3 text-center">
              <span className="text-sm font-semibold text-white drop-shadow-lg">{repoName}</span>
            </div>
          </>
        )}
      </div>

      {/* SVG edges */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <marker id="arch-arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#475569" />
          </marker>
        </defs>
        {!selectedModule && moduleEdges.map((edge, idx) => {
          const source = mainPlanets.find(n => n.id === edge.source);
          const target = mainPlanets.find(n => n.id === edge.target);
          if (!source || !target) return null;

          const isHighlighted = hoveredModule === edge.source || hoveredModule === edge.target;

          return (
            <path
              key={`arch-edge-${idx}`}
              d={`M ${source.x}% ${source.y}% L ${target.x}% ${target.y}%`}
              fill="none"
              stroke={isHighlighted ? "#818cf8" : "#334155"}
              strokeWidth={isHighlighted ? 2 : Math.min(edge.weight * 0.3, 1.5)}
              opacity={isHighlighted ? 0.9 : 0.4}
              strokeDasharray={isHighlighted ? "none" : "4,4"}
              className="transition-all duration-300"
            />
          );
        })}
      </svg>

      {/* Main planets (when not zoomed) */}
      {!selectedModule && mainPlanets.map(mod => {
        const isActive = !hoveredModule || connectedModules.has(mod.id);
        const color = PLANET_COLORS[mod.colorIdx];
        const size = 75 + Math.min(mod.fileCount * 2, 30);

        return (
          <div
            key={mod.id}
            onClick={() => handleModuleClick(mod.id)}
            onMouseEnter={() => setHoveredModule(mod.id)}
            onMouseLeave={() => setHoveredModule(null)}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-300 z-10 ${
              isActive ? `${color.bg} hover:scale-115 shadow-lg` : 'opacity-20'
            }`}
            style={{
              left: `${mod.x}%`,
              top: `${mod.y}%`,
              width: `${size}px`,
              height: `${size}px`,
              padding: '6px',
            }}
          >
            <span className="text-white text-[11px] font-semibold text-center leading-tight drop-shadow-md">{mod.label}</span>
            <span className="text-[10px] text-white/80 mt-1">{mod.fileCount} files</span>
          </div>
        );
      })}

      {/* Moons (when zoomed into a planet) */}
      {selectedModule && moonFiles.map((file, idx) => {
        const moonSize = Math.max(44, 60 - Math.min(idx * 0.25, 18));
        
        // Use style prop for guaranteed background color
        const bgColors: Record<string, string> = {
          component: '#e5e7eb',
          service: '#cbd5e1', 
          hook: '#d1d5db',
          store: '#94a3b8',
          core: '#f3f4f6',
          util: '#cbd5e1'
        };
        const bgColor = bgColors[file.type] || '#cbd5e1';

        return (
          <div
            key={file.id}
            onMouseEnter={() => setHoveredModule(file.id)}
            onMouseLeave={() => setHoveredModule(null)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 z-10 hover:scale-110 shadow-lg border-2 border-slate-500"
            style={{
              left: `${file.x}%`,
              top: `${file.y}%`,
              width: `${moonSize}px`,
              height: `${moonSize}px`,
              padding: '4px',
              backgroundColor: bgColor,
            }}
            title={file.path}
          >
            <span className="text-slate-900 text-[9px] font-semibold text-center truncate w-full leading-tight">{file.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- File Detail Panel ----

function FileDetailPanel({ node, allNodes }: { node: FileNode; allNodes: FileNode[] }) {
  const typeColor: Record<string, string> = {
    core: "bg-blue-500",
    hook: "bg-purple-500",
    component: "bg-emerald-500",
    util: "bg-amber-500",
    service: "bg-rose-500",
    store: "bg-cyan-500",
  };

  const importNodes = node.imports.map(id => allNodes.find(n => n.id === id)).filter(Boolean) as FileNode[];
  const importedByNodes = node.importedBy.map(id => allNodes.find(n => n.id === id)).filter(Boolean) as FileNode[];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded ${typeColor[node.type] || 'bg-slate-500'}`}></div>
        <span className="font-semibold text-white text-sm">{node.label}</span>
        <span className="text-xs text-slate-400 capitalize ml-auto">{node.type}</span>
      </div>
      <p className="text-xs text-slate-400 font-mono">{node.path}</p>
      <div className="text-xs text-slate-500">Module: <span className="text-slate-300">{node.module}</span></div>

      {importNodes.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1">Imports ({importNodes.length}):</p>
          <div className="flex flex-wrap gap-1">
            {importNodes.map(n => (
              <span key={n.id} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{n.label}</span>
            ))}
          </div>
        </div>
      )}

      {importedByNodes.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 font-medium mb-1">Imported by ({importedByNodes.length}):</p>
          <div className="flex flex-wrap gap-1">
            {importedByNodes.map(n => (
              <span key={n.id} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-slate-300">{n.label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Main Component ----

export function Structure() {
  const { owner, repo, apiBase } = useRepo();
  const [viewMode, setViewMode] = useState<ViewMode>("architecture");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const hasAnalyzed = !!analysisData;

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const metricsRes = await fetch(`${apiBase}/structure/metrics?owner=${owner}&repo=${repo}`);
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      } catch (err) {
        console.error('Failed to fetch metrics:', err);
      }
    }

    async function fetchOverview() {
      try {
        const overviewRes = await fetch(`${apiBase}/structure/overview?owner=${owner}&repo=${repo}`);
        const overviewData = await overviewRes.json();
        setOverview(overviewData);
      } catch (err) {
        console.error('Failed to fetch overview:', err);
      }
    }

    Promise.all([fetchMetrics(), fetchOverview()]).finally(() => setLoading(false));
  }, [owner, repo, apiBase]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${apiBase}/structure/refresh-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo })
      });
      const data = await res.json();
      setMetrics(prev => prev ? { ...prev, totalFiles: data.totalFiles, codeFiles: data.codeFiles } : null);
    } catch (err) {
      console.error('Failed to refresh metrics:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${apiBase}/structure/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, forceReindex: true })
      });
      const data: AnalysisData = await res.json();
      setAnalysisData(data);
      setMetrics(prev => prev ? {
        ...prev,
        complexity: data.cyclomaticComplexity,
        codeSmells: data.codeSmells,
        totalFiles: data.totalFiles,
        codeFiles: data.codeFiles
      } : null);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const selectedNode = selectedFile ? analysisData?.nodes.find(n => n.id === selectedFile) : null;

  return (
    <div className="p-8 space-y-6 text-slate-100 flex flex-col h-full min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Codebase Architecture</h2>
        <div className="flex gap-3 items-center">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />}
            {analyzing ? 'Analyzing...' : 'Analyze Branch'}
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Files", value: loading ? '—' : (metrics?.totalFiles?.toLocaleString() || '—'), icon: FileCode2, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Code Files", value: loading ? '—' : (metrics?.codeFiles?.toLocaleString() || '—'), icon: Package, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Cyclomatic Complexity", value: !metrics?.complexity ? '—' : `Avg ${metrics.complexity.toFixed(1)}`, icon: GitBranch, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Code Smells", value: !metrics ? '—' : (metrics?.codeSmells?.length || 0).toString(), icon: ShieldAlert, color: "text-rose-400", bg: "bg-rose-500/10" },
        ].map((metric, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4 hover:border-slate-700 transition-colors">
            <div className={`p-3 rounded-lg ${metric.bg} ${metric.color}`}>
              {loading || refreshing || analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <metric.icon className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">{metric.label}</p>
              <h3 className="text-2xl font-bold text-white mt-1">{metric.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Languages */}
      {!loading && overview?.topLanguages && overview.topLanguages.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400 font-medium">Languages:</span>
          <div className="flex flex-wrap gap-2">
            {overview.topLanguages.map((lang, idx) => (
              <span key={idx} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300">
                {lang.language} <span className="text-slate-500">{lang.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col min-h-[600px]">
        
        {/* View toggle */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex bg-slate-950/50 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("architecture")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === "architecture"
                  ? "bg-slate-800 text-indigo-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Boxes className="w-4 h-4" />
              High-Level Architecture
            </button>
            <button
              onClick={() => setViewMode("files")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                viewMode === "files"
                  ? "bg-slate-800 text-indigo-300 shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <FolderTree className="w-4 h-4" />
              File Structure
            </button>
          </div>
          
          {hasAnalyzed && viewMode === "architecture" && (
            <p className="text-xs text-slate-500">
              {analysisData.moduleNodes.length} modules, {analysisData.moduleEdges.length} connections
            </p>
          )}
          {hasAnalyzed && viewMode === "files" && (
            <p className="text-xs text-slate-500">
              {analysisData.nodes.length} files, {analysisData.edges.length} imports
            </p>
          )}
        </div>

        {/* Loading / empty states */}
        {(loading || analyzing) && (
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-slate-400">{analyzing ? 'Analyzing codebase...' : 'Loading...'}</p>
            {analyzing && <p className="text-xs text-slate-500">Parsing imports from every file</p>}
          </div>
        )}

        {!loading && !analyzing && !hasAnalyzed && (
          <div className="flex-1 flex items-center justify-center flex-col gap-3">
            <Network className="w-8 h-8 text-slate-600" />
            <p className="text-slate-400">Click "Analyze Branch" to map your codebase</p>
          </div>
        )}

        {/* Architecture view */}
        {hasAnalyzed && !analyzing && viewMode === "architecture" && (
          <div className="flex-1 relative border border-slate-800/50 bg-slate-950/40 rounded-lg overflow-hidden">
            <ArchitectureGraph
              moduleNodes={analysisData.moduleNodes}
              moduleEdges={analysisData.moduleEdges}
              repoName={`${owner}/${repo}`}
              allNodes={analysisData.nodes}
            />
          </div>
        )}

        {/* File structure view */}
        {hasAnalyzed && !analyzing && viewMode === "files" && (
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* File tree */}
            <div className="w-1/2 border border-slate-800/50 bg-slate-950/40 rounded-lg overflow-auto p-3">
              <div className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider px-2">Project Files</div>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 text-xs mb-3 px-2">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-blue-500"></div> Core</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500"></div> Component</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-rose-500"></div> Service</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-purple-500"></div> Hook</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-cyan-500"></div> Store</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-amber-500"></div> Util</span>
              </div>
              {Object.entries(analysisData.dirTree).sort(([a], [b]) => a.localeCompare(b)).map(([name, data]) => (
                <TreeNode
                  key={name}
                  name={name}
                  data={data}
                  depth={0}
                  allNodes={analysisData.nodes}
                  selectedFile={selectedFile}
                  onSelectFile={setSelectedFile}
                />
              ))}
            </div>

            {/* Detail panel */}
            <div className="w-1/2 border border-slate-800/50 bg-slate-950/40 rounded-lg overflow-auto p-4">
              {selectedNode ? (
                <FileDetailPanel node={selectedNode} allNodes={analysisData.nodes} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  <p>Select a file to see its dependencies</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
