import { createContext, useContext, useState, ReactNode } from 'react';

interface RepoContextType {
  owner: string;
  repo: string;
  branch: string;
  setRepo: (owner: string, repo: string, branch?: string) => void;
  apiBase: string;
}

const RepoContext = createContext<RepoContextType | undefined>(undefined);

export function RepoProvider({ children }: { children: ReactNode }) {
  const [owner, setOwner] = useState('acme-corp');
  const [repo, setRepoName] = useState('frontend-app');
  const [branch, setBranch] = useState('main');
  const apiBase = 'http://localhost:3000';

  const setRepo = (newOwner: string, newRepo: string, newBranch = 'main') => {
    setOwner(newOwner);
    setRepoName(newRepo);
    setBranch(newBranch);
  };

  return (
    <RepoContext.Provider value={{ owner, repo, branch, setRepo, apiBase }}>
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
