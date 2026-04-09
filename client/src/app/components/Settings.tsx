import { useState } from "react";
import { Sun, Moon, Type, Sparkles, Settings2 } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

const aiModels = [
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fastest and cheapest. Great for simple summaries.' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Balanced speed and intelligence.' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable. Best for complex analysis.' },
  { value: 'gpt-4', label: 'GPT-4', description: 'Original GPT-4. Powerful but expensive.' },
];

const technicalLevels = [
  { value: 'low', label: 'Low', description: 'Simple explanations with analogies.' },
  { value: 'medium', label: 'Medium', description: 'Balanced with some technical terms.' },
  { value: 'high', label: 'High', description: 'Full technical depth with code references.' },
];

const fontSizes = [
  { value: 'small', label: 'Small (90%)' },
  { value: 'medium', label: 'Medium (100%)' },
  { value: 'large', label: 'Large (125%)' },
  { value: 'xlarge', label: 'X-Large (150%)' },
] as const;

export function Settings() {
  const { settings, updateSettings } = useSettings();
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
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

  const Dropdown = ({ 
    value, 
    options, 
    onChange 
  }: { 
    value: string; 
    options: { value: string; label: string; description: string }[]; 
    onChange: (val: string) => void;
  }) => (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-64 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto text-slate-100">
      <div className="mb-8">
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-slate-400 mt-1">Customize your Luna experience.</p>
      </div>

      <div className="space-y-8">
        {/* Appearance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
            <Settings2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-medium text-white">Appearance</h3>
          </div>
          <div className="divide-y divide-slate-800/50">
            {/* Light Mode */}
            <div className="p-6 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-slate-800 p-2 rounded-lg text-slate-400">
                  {settings.lightMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-[15px] font-medium text-slate-200">Light Mode</h4>
                  <p className="text-sm text-slate-400 mt-1">Switch to a white background with purple sidebar.</p>
                </div>
              </div>
              <Toggle 
                checked={settings.lightMode} 
                onChange={() => updateSettings({ lightMode: !settings.lightMode })} 
              />
            </div>

            {/* Font Size */}
            <div className="p-6 hover:bg-slate-800/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-slate-800 p-2 rounded-lg text-slate-400">
                  <Type className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-[15px] font-medium text-slate-200">Text Size</h4>
                  <p className="text-sm text-slate-400 mt-1">Adjust the size of text throughout the app.</p>
                  
                  <div className="mt-4 flex items-center gap-2">
                    {fontSizes.map((size) => (
                      <button
                        key={size.value}
                        onClick={() => updateSettings({ fontSize: size.value })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          settings.fontSize === size.value
                            ? 'bg-indigo-500 text-white'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-medium text-white">AI Settings</h3>
          </div>
          <div className="divide-y divide-slate-800/50">
            {/* Model Selection */}
            <div className="p-6 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-slate-800 p-2 rounded-lg text-slate-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-medium text-slate-200">Model Selection</h4>
                  <p className="text-sm text-slate-400 mt-1">Choose which OpenAI model to use for analysis.</p>
                </div>
              </div>
              <Dropdown
                value={settings.aiModel}
                options={aiModels}
                onChange={(val) => updateSettings({ aiModel: val as typeof settings.aiModel })}
              />
            </div>

            {/* Technical Level */}
            <div className="p-6 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
              <div className="flex items-start gap-4">
                <div className="mt-1 bg-slate-800 p-2 rounded-lg text-slate-400">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[15px] font-medium text-slate-200">Technical Level</h4>
                  <p className="text-sm text-slate-400 mt-1">How technical should AI explanations be? (Excludes chat)</p>
                </div>
              </div>
              <Dropdown
                value={settings.technicalLevel}
                options={technicalLevels}
                onChange={(val) => updateSettings({ technicalLevel: val as typeof settings.technicalLevel })}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex justify-between items-center">
        <button 
          onClick={() => updateSettings({ lightMode: true, fontSize: 'medium', aiModel: 'gpt-3.5-turbo', technicalLevel: 'medium' })}
          className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors"
        >
          Reset to Defaults
        </button>
        <p className="text-xs text-slate-500">Settings are saved automatically</p>
      </div>
    </div>
  );
}
