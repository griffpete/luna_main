import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Settings = {
  lightMode: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge';
  aiModel: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4o' | 'gpt-4o-mini';
  technicalLevel: 'low' | 'medium' | 'high';
};

type SettingsContextType = {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
};

const defaultSettings: Settings = {
  lightMode: false,
  fontSize: 'medium',
  aiModel: 'gpt-3.5-turbo',
  technicalLevel: 'medium',
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem('luna-settings');
    return stored ? { ...defaultSettings, ...JSON.parse(stored) } : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('luna-settings', JSON.stringify(settings));
    
    // Apply light mode
    if (settings.lightMode) {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    
    // Apply font size to html element
    document.documentElement.classList.remove('text-small', 'text-medium', 'text-large', 'text-xlarge');
    document.documentElement.classList.add(`text-${settings.fontSize}`);
  }, [settings]);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
