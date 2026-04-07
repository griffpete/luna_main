import { useState } from "react";
import { Layers, FileCode2, Package, GitBranch, ShieldAlert, Network, Workflow, Layout as LayoutIcon, ChevronDown } from "lucide-react";

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

const VIEWS = {
  core: {
    id: "core",
    name: "Core Architecture",
    icon: Network,
    nodes: [
      { id: "app", label: "App.tsx", x: 50, y: 15, type: "core" },
      { id: "auth", label: "useAuth.ts", x: 25, y: 35, type: "hook" },
      { id: "layout", label: "Layout.tsx", x: 50, y: 40, type: "component" },
      { id: "api", label: "api.ts", x: 75, y: 35, type: "util" },
      { id: "dash", label: "Dashboard.tsx", x: 20, y: 70, type: "component" },
      { id: "struct", label: "Structure.tsx", x: 50, y: 70, type: "component" },
      { id: "chat", label: "Chat.tsx", x: 80, y: 70, type: "component" },
      { id: "db", label: "database.ts", x: 85, y: 15, type: "util" },
    ] as Node[],
    edges: [
      { source: "app", target: "layout" },
      { source: "app", target: "auth" },
      { source: "app", target: "api" },
      { source: "layout", target: "dash" },
      { source: "layout", target: "struct" },
      { source: "layout", target: "chat" },
      { source: "auth", target: "api" },
      { source: "dash", target: "api" },
      { source: "chat", target: "api" },
      { source: "api", target: "db" },
    ] as Edge[],
  },
  dataFlow: {
    id: "dataFlow",
    name: "Data Flow",
    icon: Workflow,
    nodes: [
      { id: "clientState", label: "Client State", x: 20, y: 50, type: "core" },
      { id: "redux", label: "Redux Store", x: 50, y: 20, type: "store" },
      { id: "gateway", label: "API Gateway", x: 50, y: 50, type: "util" },
      { id: "authSvc", label: "Auth Service", x: 80, y: 20, type: "service" },
      { id: "cache", label: "Redis Cache", x: 50, y: 80, type: "store" },
      { id: "dbPrimary", label: "Primary DB", x: 80, y: 80, type: "service" },
    ] as Node[],
    edges: [
      { source: "clientState", target: "redux" },
      { source: "clientState", target: "gateway" },
      { source: "redux", target: "gateway" },
      { source: "gateway", target: "authSvc" },
      { source: "gateway", target: "cache" },
      { source: "gateway", target: "dbPrimary" },
      { source: "authSvc", target: "dbPrimary" },
      { source: "cache", target: "dbPrimary" },
    ] as Edge[],
  },
  uiComponents: {
    id: "uiComponents",
    name: "UI Components",
    icon: LayoutIcon,
    nodes: [
      { id: "mainLayout", label: "MainLayout", x: 50, y: 15, type: "component" },
      { id: "sidebar", label: "Sidebar", x: 25, y: 40, type: "component" },
      { id: "topbar", label: "TopHeader", x: 75, y: 40, type: "component" },
      { id: "navItem", label: "NavItem", x: 25, y: 70, type: "component" },
      { id: "userMenu", label: "UserMenu", x: 60, y: 70, type: "component" },
      { id: "themeBtn", label: "ThemeToggle", x: 90, y: 70, type: "component" },
    ] as Node[],
    edges: [
      { source: "mainLayout", target: "sidebar" },
      { source: "mainLayout", target: "topbar" },
      { source: "sidebar", target: "navItem" },
      { source: "topbar", target: "userMenu" },
      { source: "topbar", target: "themeBtn" },
    ] as Edge[],
  }
};

type ScopeType = "All" | "Server" | "Client" | "Other";

export function Structure() {
  const [activeViewId, setActiveViewId] = useState<keyof typeof VIEWS>("core");
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scope, setScope] = useState<ScopeType>("All");

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
          <button className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-[0_0_15px_rgba(99,102,241,0.3)]">
            <Layers className="w-4 h-4" />
            Analyze Branch
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Total Files", value: "1,248", icon: FileCode2, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Dependencies", value: "86", icon: Package, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Cyclomatic Complexity", value: "Avg 4.2", icon: GitBranch, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Code Smells", value: "24", icon: ShieldAlert, color: "text-rose-400", bg: "bg-rose-500/10" },
        ].map((metric, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4 hover:border-slate-700 transition-colors">
            <div className={`p-3 rounded-lg ${metric.bg} ${metric.color}`}>
              <metric.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-slate-400 font-medium">{metric.label}</p>
              <h3 className="text-2xl font-bold text-white mt-1">{metric.value}</h3>
            </div>
          </div>
        ))}
      </div>

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
          
          {filteredNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 flex-col gap-2">
              <ShieldAlert className="w-8 h-8 opacity-50" />
              <p>No nodes found for this scope.</p>
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
