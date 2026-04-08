const express = require('express');
const { Octokit } = require('@octokit/rest');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { getLastAnalysis, setLastAnalysis, getAnalysisData, setAnalysisData, getOverviewData } = require('../utils/state');

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

function getCollectionName(owner, repo) {
  return `${owner}_${repo}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getEmbeddings() {
  return new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_TOKEN });
}

function getOpenAI() {
  const OpenAI = require('openai');
  return new OpenAI({ apiKey: process.env.OPENAI_TOKEN });
}

function safeJsonParse(text) {
  try {
    text = text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error('Safe JSON parse failed:', e.message);
    return null;
  }
}

router.get('/structure/overview', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    const lastAnalysis = await getLastAnalysis(owner, repo);

    let topLanguages = [];
    let totalFiles = 0;
    let codeFiles = 0;

    try {
      const { data: tree } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: 'HEAD',
        recursive: 'true'
      });

      const files = tree.tree.filter(f => f.type === 'blob');
      totalFiles = files.length;

      codeFiles = files.filter(f => {
        const ext = f.path.split('.').pop()?.toLowerCase();
        return ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'rb', 'php', 'c', 'cpp', 'cs'].includes(ext);
      }).length;

      const languages = {};
      files.forEach(f => {
        const ext = f.path.split('.').pop()?.toLowerCase();
        const langMap = {
          'js': 'JavaScript', 'jsx': 'JavaScript', 'ts': 'TypeScript', 'tsx': 'TypeScript',
          'py': 'Python', 'java': 'Java', 'go': 'Go', 'rs': 'Rust',
          'rb': 'Ruby', 'php': 'PHP', 'c': 'C', 'cpp': 'C++', 'cs': 'C#'
        };
        if (langMap[ext]) {
          languages[langMap[ext]] = (languages[langMap[ext]] || 0) + 1;
        }
      });

      topLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang, count]) => ({ language: lang, count }));
    } catch (githubError) {
      console.log('GitHub API failed, returning cached data');
    }

    const response = {
      totalFiles,
      codeFiles,
      topLanguages,
      description: lastAnalysis?.description || null,
      recentHistory: lastAnalysis?.recentHistory || null,
      direction: lastAnalysis?.direction || null
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/structure/dependencies', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true'
    });

    const files = tree.tree.filter(f => f.type === 'blob');
    const packageJson = files.find(f => f.path === 'package.json' || f.path.endsWith('/package.json'));
    const requirements = files.find(f => f.path === 'requirements.txt' || f.path.endsWith('/requirements.txt'));

    const dependencies = { npm: [], pip: [] };

    if (packageJson) {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: packageJson.path });
        const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
        dependencies.npm = [
          ...Object.keys(content.dependencies || {}),
          ...Object.keys(content.devDependencies || {})
        ];
      } catch (e) {}
    }

    if (requirements) {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: requirements.path });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        dependencies.pip = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      } catch (e) {}
    }

    res.json({ dependencies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/structure/status', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 1
    });

    const currentCommitCount = commits[0]?.commit?.message ? 1 : 0;
    const lastAnalysis = await getLastAnalysis(owner, repo);

    res.json({
      currentCommitCount,
      lastAnalysis,
      needsAnalysis: !lastAnalysis || currentCommitCount > lastAnalysis.commitCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/structure/overview', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    const lastAnalysis = await getLastAnalysis(owner, repo);

    let topLanguages = [];
    let totalFiles = 0;
    let codeFiles = 0;

    try {
      const { data: tree } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: 'HEAD',
        recursive: 'true'
      });

      const files = tree.tree.filter(f => f.type === 'blob');
      totalFiles = files.length;

      codeFiles = files.filter(f => {
        const ext = f.path.split('.').pop()?.toLowerCase();
        return ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'rb', 'php', 'c', 'cpp', 'cs'].includes(ext);
      }).length;

      const languages = {};
      files.forEach(f => {
        const ext = f.path.split('.').pop()?.toLowerCase();
        const langMap = {
          'js': 'JavaScript', 'jsx': 'JavaScript', 'ts': 'TypeScript', 'tsx': 'TypeScript',
          'py': 'Python', 'java': 'Java', 'go': 'Go', 'rs': 'Rust',
          'rb': 'Ruby', 'php': 'PHP', 'c': 'C', 'cpp': 'C++', 'cs': 'C#'
        };
        if (langMap[ext]) {
          languages[langMap[ext]] = (languages[langMap[ext]] || 0) + 1;
        }
      });

      topLanguages = Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang, count]) => ({ language: lang, count }));
    } catch (githubError) {
      console.log('GitHub API failed, returning cached data');
    }

    const response = {
      totalFiles,
      codeFiles,
      topLanguages,
      description: lastAnalysis?.description || null,
      recentHistory: lastAnalysis?.recentHistory || null,
      direction: lastAnalysis?.direction || null
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/structure/refresh-overview', async (req, res) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 10
    });

    const recentCommitsContext = commits.map(c => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date
    }));

    let codeContext = '';
    try {
      const collectionName = getCollectionName(owner, repo);
      const vectorstore = await Chroma.fromExistingCollection(getEmbeddings(), {
        collectionName,
        host: 'localhost',
        port: 8000
      });
      const results = await vectorstore.similaritySearch('project structure, main files, purpose, architecture', 10);
      codeContext = results.map(r => `File: ${r.metadata.path}\n${r.pageContent.slice(0, 500)}`).join('\n\n');
    } catch (e) {
      console.log('ChromaDB not available, using commits only');
      codeContext = '';
    }

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a project analyst. Analyze the provided information and return a JSON object with exactly these fields:

1. "description": A concise 1-2 sentence description of what this project does based on the codebase structure and commit history. Make it accessible to non-technical stakeholders.

2. "recentHistory": A brief paragraph summarizing what has been worked on recently (last 5-10 commits). Focus on what features were added, bugs were fixed, or major changes were made.

3. "direction": Based on the recent commit history and patterns, describe the current trajectory of the project. Is it in active development? Maintenance mode? New feature development? Refactoring? Be specific.

Return ONLY valid JSON with these three fields, nothing else.`
        },
        {
          role: 'user',
          content: `Recent commits:\n${JSON.stringify(recentCommitsContext, null, 2)}${codeContext ? '\n\nCodebase context:\n' + codeContext.slice(0, 2000) : ''}`
        }
      ]
    });

    let overviewData = { description: null, recentHistory: null, direction: null };
    try {
      const rawRefresh = completion.choices[0].message.content;
      console.log('Refresh AI response:', rawRefresh.slice(0, 300));
      overviewData = safeJsonParse(rawRefresh) || overviewData;
      console.log('Refresh parsed:', overviewData);
    } catch (e) {
      console.error('Failed to parse overview response:', e);
    }

    const lastAnalysis = await getLastAnalysis(owner, repo);
    await setLastAnalysis(owner, repo, lastAnalysis?.commitCount || commits.length, commits[0]?.sha, overviewData);

    res.json(overviewData);
  } catch (error) {
    console.error('Refresh overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/structure/analyze', async (req, res) => {
  const { owner, repo, forceReindex = false } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  const collectionName = getCollectionName(owner, repo);
  const openai = getOpenAI();

  try {
    let needsIndex = forceReindex;
    let commitCount = 0;
    
    if (!needsIndex) {
      const { data: commits } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 100
      });
      const lastAnalysis = await getLastAnalysis(owner, repo);
      commitCount = commits.length;
      
      if (!lastAnalysis || commits.length > lastAnalysis.commitCount) {
        needsIndex = true;
      }
    }

    if (needsIndex) {
      const { data: tree } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: 'HEAD',
        recursive: 'true'
      });

      const files = tree.tree.filter(f => {
        if (f.type !== 'blob') return false;
        const path = f.path.toLowerCase();
        if (['node_modules', 'dist', 'build', '.git', 'venv'].some(d => path.includes(`${d}/`))) return false;
        const blockedExts = ['.db', '.sqlite', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.zip', '.pdf', '.lock', '.map'];
        if (blockedExts.some(ext => path.endsWith(ext))) return false;
        if (f.path.split('/').some(p => p.startsWith('.'))) return false;
        return f.size < 100000;
      });

      const { ChromaClient } = require('chromadb');
      const client = new ChromaClient({ path: 'http://localhost:8000' });
      try {
        await client.deleteCollection({ name: collectionName });
      } catch (e) {}

      const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
      const docs = [];
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async (f) => {
          try {
            const { data } = await octokit.repos.getContent({ owner, repo, path: f.path });
            if (data.type === 'file') {
              return {
                pageContent: Buffer.from(data.content, 'base64').toString('utf-8'),
                metadata: { path: f.path, repo: `${owner}/${repo}` }
              };
            }
          } catch (e) {}
          return null;
        }));
        docs.push(...results.filter(Boolean));
      }

      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
      const chunks = await splitter.splitDocuments(docs);

      await Chroma.fromDocuments(chunks, getEmbeddings(), {
        collectionName,
        host: 'localhost',
        port: 8000
      });

      const { data: finalCommits } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 1000
      });
      commitCount = finalCommits.length;
    }

    let codeContext = '';
    let analysis = {
      cyclomaticComplexity: 3.5,
      codeSmells: [],
      coreArchitecture: [],
      dataFlow: [],
      uiComponents: []
    };

    try {
      const vectorstore = await Chroma.fromExistingCollection(getEmbeddings(), {
        collectionName,
        host: 'localhost',
        port: 8000
      });

      const [componentsResult, servicesResult, hooksResult, utilsResult] = await Promise.all([
        vectorstore.similaritySearch('React components, pages, layouts, UI elements with imports exports', 30),
        vectorstore.similaritySearch('services, API calls, data fetching, business logic', 20),
        vectorstore.similaritySearch('hooks, useState, useEffect, custom hooks', 15),
        vectorstore.similaritySearch('utils, helpers, constants, configuration, types, interfaces', 15)
      ]);

      const allFiles = new Map();
      [...componentsResult, ...servicesResult, ...hooksResult, ...utilsResult].forEach(r => {
        if (!allFiles.has(r.metadata.path)) {
          allFiles.set(r.metadata.path, r.pageContent.slice(0, 1500));
        }
      });

      codeContext = Array.from(allFiles.entries())
        .map(([path, content]) => `File: ${path}\n${content}`)
        .join('\n\n---\n\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are explaining a codebase to a NON-TECHNICAL project manager. Create a visualization of how the application is structured.

CRITICAL RULES:
- NO file extensions (no .tsx, .js, .html, etc.)
- Use HUMAN-READABLE names (e.g., "Dashboard" not "Dashboard.tsx", "Auth Hook" not "useAuth.ts")
- Every node MUST have 1-3 connections to other nodes
- If connections aren't clear, make REASONABLE ASSUMPTIONS based on:
  - Import relationships (A imports B = A depends on B)
  - Framework patterns (components use hooks, pages use components)
  - Data flow direction

NODE NAMING EXAMPLES:
- "Dashboard" not "Dashboard.tsx"
- "Auth" not "AuthContext.tsx"  
- "User Data" not "useUser.ts"
- "Main App" not "App.tsx"
- "API Client" not "api/client.js"

STRUCTURE TO RETURN:

1. "cyclomaticComplexity": Average complexity number (1-10 scale)

2. "codeSmells": Array of {type, file (keep readable), description, severity} - plain English issues

3. "coreArchitecture": Main structural components
   - Entry point (Main App)
   - State management (User State, App Settings)
   - Router/Navigation
   - API Communication
   Each: {id, label, type: "core"|"service"|"config", dependencies: [otherNodeIds]}

4. "dataFlow": How data moves through the app
   - Data sources (Database, External APIs)
   - Data processing (Transformers, Validators)
   - Data storage (Local storage, Session)
   Each: {id, label, type, connections: [nodeIds]}

5. "uiComponents": User interface hierarchy
   - Pages (Dashboard, Settings, Chat, Login)
   - Layouts (Main Layout, Sidebar)
   - Shared components (Buttons, Forms, Cards)
   - Feature-specific components
   Each: {id, label, parentId, children: [nodeIds]}

Example node: {id: "dashboard", label: "Dashboard", type: "component", parentId: "main-layout", children: ["charts", "recent-activity"]}

Return ONLY valid JSON. Minimum 15 nodes total across all views.`
          },
          {
            role: 'user',
            content: `Analyze and explain this codebase structure for a project manager:\n\n${codeContext}`
          }
        ]
      });

      try {
        const rawResponse = completion.choices[0].message.content;
        console.log('AI response preview:', rawResponse.slice(0, 200));
        analysis = safeJsonParse(rawResponse) || analysis;
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    } catch (chromaError) {
      console.error('ChromaDB retrieval failed:', chromaError);
    }

    const { data: recentCommits } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 10
    });

    const recentCommitsContext = recentCommits.map(c => ({
      sha: c.sha.substring(0, 7),
      message: c.commit.message.split('\n')[0],
      author: c.commit.author.name,
      date: c.commit.author.date
    }));

    const overviewCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a project analyst. Analyze the provided information and return a JSON object with exactly these fields:

1. "description": A concise 1-2 sentence description of what this project does based on the codebase structure. Make it accessible to non-technical stakeholders.

2. "recentHistory": A brief paragraph summarizing what has been worked on recently (last 5-10 commits). Focus on what features were added, bugs were fixed, or major changes were made.

3. "direction": Based on the recent commit history and patterns, describe the current trajectory of the project. Is it in active development? Maintenance mode? New feature development? Refactoring? Be specific.

Return ONLY valid JSON with these three fields, nothing else.`
        },
        {
          role: 'user',
          content: `Recent commits:\n${JSON.stringify(recentCommitsContext, null, 2)}`
        }
      ]
    });

    let overviewData = { description: null, recentHistory: null, direction: null };
    try {
      const rawOverview = overviewCompletion.choices[0].message.content;
      console.log('Overview AI response:', rawOverview.slice(0, 300));
      overviewData = safeJsonParse(rawOverview) || overviewData;
      console.log('Parsed overview data:', overviewData);
    } catch (e) {
      console.error('Failed to parse overview response:', e);
    }

    await setLastAnalysis(owner, repo, commitCount, recentCommits[0]?.sha, overviewData);
    await setAnalysisData(owner, repo, analysis);

    res.json({ ...analysis, ...overviewData });
  } catch (error) {
    console.error('Analyze endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
