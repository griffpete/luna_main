import { useState } from "react";
import { Bell, Shield, GitBranch, Sparkles, Database, Eye, Activity, SlidersHorizontal } from "lucide-react";

export function Settings() {
  const [settings, setSettings] = useState({
    autoSync: true,
    backgroundAnalysis: true,
    aiSuggestions: true,
    showCodeSmells: true,
    emailAlerts: false,
    publicDashboard: false,
    highContrast: false,
    experimentalFeatures: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
        checked ? 'bg-indigo-500' : 'bg-slate-700'
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const sections = [
    {
      title: "Repository Analysis",
      icon: Activity,
      items: [
        { id: "autoSync", label: "Auto-sync Repository", description: "Automatically fetch and analyze new commits on the main branch.", icon: GitBranch },
        { id: "backgroundAnalysis", label: "Background Deep Analysis", description: "Run complex cyclomatic complexity checks in the background.", icon: Database },
      ]
    },
    {
      title: "Luna AI Preferences",
      icon: Sparkles,
      items: [
        { id: "aiSuggestions", label: "Enable AI Code Suggestions", description: "Allow Luna to suggest refactoring improvements in the chat.", icon: Sparkles },
        { id: "showCodeSmells", label: "Highlight Code Smells", description: "Visually indicate potential issues in the codebase structure map.", icon: Eye },
      ]
    },
    {
      title: "Notifications & Privacy",
      icon: Shield,
      items: [
        { id: "emailAlerts", label: "Email Alerts for Critical Issues", description: "Get notified when a commit introduces significant technical debt.", icon: Bell },
        { id: "publicDashboard", label: "Public Dashboard Link", description: "Allow anyone with the link to view this repository's insights.", icon: Shield },
      ]
    },
    {
      title: "Appearance & Accessibility",
      icon: SlidersHorizontal,
      items: [
        { id: "highContrast", label: "High Contrast Mode", description: "Increase contrast for better readability of graphs and metrics.", icon: Eye },
        { id: "experimentalFeatures", label: "Enable Experimental Features", description: "Get early access to beta visualizers and AI models.", icon: SlidersHorizontal },
      ]
    }
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto text-slate-100">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-slate-400 mt-1">Manage your workspace preferences, AI configurations, and repository tracking.</p>
      </div>

      <div className="space-y-8">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
              <section.icon className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-medium text-white">{section.title}</h3>
            </div>
            <div className="divide-y divide-slate-800/50">
              {section.items.map((item) => (
                <div key={item.id} className="p-6 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
                  <div className="flex items-start gap-4 pr-8">
                    <div className="mt-1 bg-slate-800 p-2 rounded-lg text-slate-400">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-medium text-slate-200">{item.label}</h4>
                      <p className="text-sm text-slate-400 mt-1">{item.description}</p>
                    </div>
                  </div>
                  <Toggle 
                    checked={settings[item.id as keyof typeof settings]} 
                    onChange={() => toggleSetting(item.id as keyof typeof settings)} 
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 flex justify-end gap-4">
        <button className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors">
          Reset to Defaults
        </button>
        <button className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm">
          Save Changes
        </button>
      </div>
    </div>
  );
}
