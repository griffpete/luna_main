import { useState, useEffect } from "react";
import { FileCode2, Package, GitBranch, ShieldAlert, Network, Workflow, Layout as LayoutIcon, ChevronDown, Loader2 } from "lucide-react";
import { useRepo } from "../context/RepoContext";

type NodeType = "core" | "hook" | "component" | "util" | "service" | "store";

interface Node {
  id: string;
  label: string;
  x: number;
  y: number;
  type: NodeType;
}

interface Edge {
  source: string;
  target: string;
}

interface ViewData {
  id: string;
  name: string;
  icon: typeof Network;
  nodes: Node[];
  edges: Edge[];
}

interface OverviewData {
  totalFiles: number;
  codeFiles: number;
  dependencyFiles: number;
  topLanguages: { language: string; count: number }[];
}

interface AnalysisData {
  cyclomaticComplexity: number;
  codeSmells: { type: string; file: string; description: string; severity: string }[];
  coreArchitecture: { id: string; label: string; type: NodeType; dependencies: string[] }[];
  dataFlow: { id: string; label: string; type: NodeType; connections: string[] }[];
  uiComponents: { id: string; label: string; parentId?: string; children: string[] }[];
}

const generateNodePositions = (nodes: { id: string; label: string; type: NodeType }[]): Node[] => {
  const cols = 4;
  return nodes.map((node, idx) => ({
    ...node,
    x: 15 + (idx % cols) * 25,
    y: 20 + Math.floor(idx / cols) * 30
  }));
};

const VIEWS: Record<string, ViewData> = {
  core: { id: "core", name: "Core Architecture", icon: Network, nodes: [], edges: [] },
  dataFlow: { id: "dataFlow", name: "Data Flow", icon: Workflow, nodes: [], edges: [] },
  uiComponents: { id: "uiComponents", name: "UI Components", icon: LayoutIcon, nodes: [], edges: [] }
};

type ScopeType = "All" | "Server" | "Client" | "Other";

export function Structure() {
  const { owner, repo, apiBase } = useRepo();
  const [activeViewId, setActiveViewId] = useState<keyof typeof VIEWS>("core");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeType>("All");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const overviewRes = await fetch(`${apiBase}/structure/overview?owner=${owner}&repo=${repo}`);
        const overviewData = await overviewRes.json();
        setOverview(overviewData);

        const statusRes = await fetch(`${apiBase}/structure/status?owner=${owner}&repo=${repo}`);
        const statusData = await statusRes.json();

        if (!statusData.needsAnalysis && statusData.lastAnalysis) {
          const analysisRes = await fetch(`${apiBase}/structure/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ owner, repo, forceReindex: false })
          });
          const analysisData = await analysisRes.json();
          setAnalysis(analysisData);
          setHasAnalyzed(true);
          processAnalysisData(analysisData);
        }
      } catch (err) {
        console.error('Failed to fetch structure data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [owner, repo, apiBase]);

  function processAnalysisData(analysisData: AnalysisData) {
    if (analysisData.coreArchitecture) {
      const coreNodes = analysisData.coreArchitecture.map((c: any) => ({
        id: c.id,
        label: c.label,
        type: c.type as NodeType
      }));
      VIEWS.core.nodes = generateNodePositions(coreNodes);
      VIEWS.core.edges = analysisData.coreArchitecture.flatMap((c: any) =>
        (c.dependencies || []).map((dep: string) => ({ source: c.id, target: dep }))
      ).filter((e: Edge) => 
        coreNodes.some(n => n.id === e.target) || 
        coreNodes.some(n => n.id === e.source)
      );
    }

    if (analysisData.dataFlow) {
      const flowNodes = analysisData.dataFlow.map((d: any) => ({
        id: d.id,
        label: d.label,
        type: d.type as NodeType
      }));
      VIEWS.dataFlow.nodes = generateNodePositions(flowNodes);
      VIEWS.dataFlow.edges = analysisData.dataFlow.flatMap((d: any) =>
        (d.connections || []).map((conn: string) => ({ source: d.id, target: conn }))
      ).filter((e: Edge) => 
        flowNodes.some(n => n.id === e.target) || 
        flowNodes.some(n => n.id === e.source)
      );
    }

    if (analysisData.uiComponents) {
      const uiNodes = analysisData.uiComponents.map((u: any) => ({
        id: u.id,
        label: u.label,
        type: "component" as NodeType
      }));
      VIEWS.uiComponents.nodes = generateNodePositions(uiNodes);
      VIEWS.uiComponents.edges = analysisData.uiComponents.flatMap((u: any) => {
        const edges: Edge[] = [];
        if (u.children) {
          u.children.forEach((child: string) => {
            edges.push({ source: u.id, target: child });
          });
        }
        if (u.parentId) {
          edges.push({ source: u.parentId, target: u.id });
        }
        return edges;
      }).filter((e: Edge) => 
        uiNodes.some(n => n.id === e.target) || 
        uiNodes.some(n => n.id === e.source)
      );
    }
  }

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch(`${apiBase}/structure/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner, repo, forceReindex: true })
      });
      const data = await res.json();
      setAnalysis(data);
      setHasAnalyzed(true);
      processAnalysisData(data);
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const currentView = VIEWS[activeViewId];

  // Filter logic based on scope
  const filteredNodes = currentView.nodes.filter((node) => {
    if (scope === "All") return true;
    if (scope === "Server") return ["service", "store"].includes(node.type);
    if (scope === "Client") return ["core", "hook", "component"].includes(node.type);
    if (scope === "Other") return ["util"].includes(node.type);
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = currentView.edges.filter(
    (edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  );

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case "core": return "bg-blue-500 border-blue-400 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]";
      case "hook": return "bg-purple-500 border-purple-400 text-white";
      case "component": return "bg-emerald-500 border-emerald-400 text-white";
      case "util": return "bg-amber-500 border-amber-400 text-white";
      case "service": return "bg-rose-500 border-rose-400 text-white shadow-[0_0_10px_rgba(244,63,94,0.3)]";
      case "store": return "bg-cyan-500 border-cyan-400 text-white";
      default: return "bg-slate-700 border-slate-600 text-slate-200";
    }
  };

  const getEdgeStyle = (edge: Edge) => {
    if (!hoveredNode) return { stroke: "#334155", strokeWidth: 1.5, opacity: 0.6 };
    if (edge.source === hoveredNode || edge.target === hoveredNode) {
      return { stroke: "#818cf8", strokeWidth: 2.5, opacity: 1 };
    }
    return { stroke: "#1e293b", strokeWidth: 1, opacity: 0.1 };
  };

  return (
    <div className="p-8 space-y-8 text-slate-100 flex flex-col h-full min-h-screen">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Codebase Architecture</h2>
        <div className="flex gap-3 items-center">
          <div className="relative group">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeType)}
              className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 py-2 pl-4 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors cursor-pointer shadow-sm"
            >
              <option value="All">All Features</option>
              <option value="Server">Server</option>
              <option value="Client">Client</option>
              <option value="Other">Other</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-slate-300 transition-colors" />
          </div>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Files", value: loading ? '—' : (overview?.totalFiles?.toLocaleString() || '—'), icon: FileCode2, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Code Files", value: loading ? '—' : (overview?.codeFiles?.toLocaleString() || '—'), icon: Package, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Cyclomatic Complexity", value: analyzing || !analysis ? '—' : `Avg ${analysis?.cyclomaticComplexity?.toFixed(1) || '—'}`, icon: GitBranch, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Code Smells", value: analyzing || !analysis ? '—' : (analysis?.codeSmells?.length || 0).toString(), icon: ShieldAlert, color: "text-rose-400", bg: "bg-rose-500/10" },
        ].map((metric, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4 hover:border-slate-700 transition-colors">
            <div className={`p-3 rounded-lg ${metric.bg} ${metric.color}`}>
              {loading || analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <metric.icon className="w-6 h-6" />}
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">{metric.label}</p>
              <h3 className="text-2xl font-bold text-white mt-1">{metric.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Languages Row */}
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

      {/* Main Focus: Interactive Component Mind Map */}
      <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col relative min-h-[600px] overflow-hidden">
        
        {/* Graph Header & View Switcher */}
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-20 relative">
          <div>
            <h3 className="text-xl font-semibold text-white">Interactive Dependency Graph</h3>
            <p className="text-sm text-slate-400 mt-1">Hover over nodes to see their connections.</p>
          </div>
          
          <div className="flex bg-slate-950/50 border border-slate-800 p-1 rounded-lg backdrop-blur-sm">
            {(Object.values(VIEWS) as typeof currentView[]).map((view) => (
              <button
                key={view.id}
                onClick={() => setActiveViewId(view.id as keyof typeof VIEWS)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  activeViewId === view.id 
                    ? "bg-slate-800 text-indigo-300 shadow-sm" 
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <view.icon className="w-4 h-4" />
                {view.name}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs z-20 relative mb-4">
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-blue-500"></div> Core/Client</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-emerald-500"></div> UI Components</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-amber-500"></div> Utils/API</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-purple-500"></div> Hooks</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-cyan-500"></div> Store/Cache</span>
          <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-rose-500"></div> Services/DB</span>
        </div>

        {/* Graph Area */}
        <div className="flex-1 relative mt-2 border border-slate-800/50 bg-slate-950/40 rounded-lg overflow-hidden w-full h-full">
          
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 flex-col gap-3 z-20">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
              <p>Loading...</p>
            </div>
          )}

          {!loading && !hasAnalyzed && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 flex-col gap-3 z-20">
              <ShieldAlert className="w-8 h-8 opacity-50" />
              <p>Click "Analyze Branch" in the header to start analysis</p>
            </div>
          )}

          {/* SVG for Edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
              </marker>
              <marker id="arrowhead-highlight" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#818cf8" />
              </marker>
            </defs>
            {filteredEdges.map((edge, idx) => {
              const sourceNode = filteredNodes.find(n => n.id === edge.source);
              const targetNode = filteredNodes.find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;
              
              const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target;
              const style = getEdgeStyle(edge);

              return (
                <line
                  key={`${currentView.id}-edge-${idx}`}
                  x1={`${sourceNode.x}%`}
                  y1={`${sourceNode.y}%`}
                  x2={`${targetNode.x}%`}
                  y2={`${targetNode.y}%`}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  opacity={style.opacity}
                  className="transition-all duration-300 ease-in-out"
                  markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
                />
              );
            })}
          </svg>

          {/* HTML for Nodes */}
          {filteredNodes.map((node) => (
            <div
              key={`${currentView.id}-node-${node.id}`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              className={`absolute px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-300 cursor-pointer flex items-center justify-center -translate-x-1/2 -translate-y-1/2 hover:scale-110 z-10 ${getNodeColor(node.type)}`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                minWidth: '110px',
              }}
            >
              {node.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
