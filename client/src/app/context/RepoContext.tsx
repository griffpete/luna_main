import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface RepoContextType {
  owner: string;
  repo: string;
  branch: string;
  refreshKey: number;
  setRepo: (owner: string, repo: string, branch?: string) => void;
  triggerRefresh: () => void;
  apiBase: string;
}

const STORAGE_KEY = 'luna-last-repo';

interface StoredRepo {
  owner: string;
  repo: string;
  branch: string;
}

function getStoredRepo(): StoredRepo | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse stored repo:', e);
  }
  return null;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export function RepoProvider({ children }: { children: ReactNode }) {
  const stored = getStoredRepo();
  const [owner, setOwner] = useState(stored?.owner || 'griffpete');
  const [repo, setRepoName] = useState(stored?.repo || 'hotTake');
  const [branch, setBranch] = useState(stored?.branch || 'main');
  const [refreshKey, setRefreshKey] = useState(0);
  const apiBase = 'http://localhost:3000';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner, repo, branch }));
    } catch (e) {
      console.error('Failed to save repo to storage:', e);
    }
  }, [owner, repo, branch]);

  const setRepo = (newOwner: string, newRepo: string, newBranch = 'main') => {
    setOwner(newOwner);
    setRepoName(newRepo);
    setBranch(newBranch);
  };

  const triggerRefresh = () => {
    setRefreshKey(k => k + 1);
  };

  return (
    <RepoContext.Provider value={{ owner, repo, branch, refreshKey, setRepo, triggerRefresh, apiBase }}>
      {children}
    </RepoContext.Provider>
  );
}

export function useRepo() {
  const context = useContext(RepoContext);
  if (!context) {
    throw new Error('useRepo must be used within a RepoProvider');
  }
  return context;
}
