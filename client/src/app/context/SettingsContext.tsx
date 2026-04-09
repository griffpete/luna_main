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
  lightMode: true,
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
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('luna-settings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    
    localStorage.setItem('luna-settings', JSON.stringify(settings));
    
    // Apply dark mode class
    if (settings.lightMode) {
      document.body.classList.remove('dark');
    } else {
      document.body.classList.add('dark');
    }
    
    // Apply font size
    document.documentElement.classList.remove('text-small', 'text-medium', 'text-large', 'text-xlarge');
    document.documentElement.classList.add(`text-${settings.fontSize}`);
  }, [settings, isInitialized]);

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
