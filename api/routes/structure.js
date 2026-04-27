const express = require('express');
const { Octokit } = require('@octokit/rest');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { getLastAnalysis, setLastAnalysis, getAnalysisData, setAnalysisData, getOverviewData, getMetrics } = require('../utils/state');
const path = require('path');

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
    
    let jsonStr = null;
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    } else {
      const bracketStart = text.indexOf('{');
      const bracketEnd = text.lastIndexOf('}');
      if (bracketStart !== -1 && bracketEnd !== -1 && bracketEnd > bracketStart) {
        jsonStr = text.substring(bracketStart, bracketEnd + 1);
      }
    }
    
    if (!jsonStr) return null;
    
    const parsed = JSON.parse(jsonStr);
    
    if (parsed.recentHistory && Array.isArray(parsed.recentHistory)) {
      parsed.recentHistory = parsed.recentHistory.join('\n');
    }
    if (parsed.direction && Array.isArray(parsed.direction)) {
      parsed.direction = parsed.direction.join('\n');
    }
    
    return parsed;
  } catch (e) {
    console.error('Safe JSON parse failed:', e.message, 'Input:', text.substring(0, 200));
    return null;
  }
}

function getTechnicalLevelPrompt(level = 'medium') {
  const prompts = {
    low: `You are explaining code to a non-technical audience. Use simple, everyday language. Avoid jargon and technical terms. Create analogies and metaphors to explain concepts. Focus on WHAT the code does rather than HOW it works technically. Be concise and friendly.`,
    medium: `You are explaining code to a general audience with some technical familiarity. Use clear language and briefly explain technical terms when they appear. Balance simplicity with accuracy. Be informative but accessible.`,
    high: `You are explaining code to a technical audience. Use precise terminology, reference specific patterns and implementations, discuss architectural decisions, and provide detailed technical explanations. Include relevant code examples when helpful.`
  };
  return prompts[level] || prompts.medium;
}

function getOverviewPrompt(level = 'medium') {
  const technicalContext = getTechnicalLevelPrompt(level);
  return `${technicalContext}

IMPORTANT: recentHistory and direction must be PLAIN TEXT STRINGS, NOT arrays. Use newline characters between lines.

Return a JSON object with exactly these fields:

1. "description": A string - concise 1-2 sentence description of what this project does.

2. "recentHistory": A STRING (not array) with 3-5 lines about what was worked on recently. Each line must be ONE COMPLETE SENTENCE ending with a period. Separate lines with newline characters. Example:
"Added new authentication feature.\\nFixed memory leak in data processor.\\nUpdated API client to support new endpoints."

3. "direction": A STRING (not array) with 3-5 lines about the project's trajectory. Each line must be ONE COMPLETE SENTENCE ending with a period. Separate lines with newline characters. Example:
"Active development on mobile support.\\nPerformance optimization is a current focus.\\nPlanning major release for next quarter."

Return ONLY valid JSON with these three fields, nothing else.`;
}

// ---- Deterministic import parsing ----

const CODE_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'go', 'rs', 'rb', 'php', 'c', 'cpp', 'cs', 'vue', 'svelte'];
const SKIP_DIRS = ['node_modules', 'dist', 'build', '.git', 'venv', '__pycache__', '.next', 'coverage'];
const SKIP_EXTS = ['.db', '.sqlite', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.zip', '.pdf', '.lock', '.map', '.ico', '.woff', '.woff2', '.ttf', '.eot'];

function shouldIncludeFile(filePath, size) {
  const lower = filePath.toLowerCase();
  if (SKIP_DIRS.some(d => lower.includes(`${d}/`))) return false;
  if (SKIP_EXTS.some(ext => lower.endsWith(ext))) return false;
  if (filePath.split('/').some(p => p.startsWith('.'))) return false;
  if (size > 100000) return false;
  return true;
}

function isCodeFile(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  return CODE_EXTENSIONS.includes(ext);
}

function categorizeFile(filePath) {
  const lower = filePath.toLowerCase();
  const filename = filePath.split('/').pop().toLowerCase();

  // Routes / API endpoints
  if (lower.includes('/routes/') || lower.includes('/api/') || lower.includes('/controllers/')) return 'service';
  // Server entry / config
  if (filename === 'server.js' || filename === 'server.ts' || filename === 'app.js' || filename === 'app.ts') return 'core';
  // Hooks
  if (filename.startsWith('use') || lower.includes('/hooks/')) return 'hook';
  // Context / Store / State
  if (lower.includes('context') || lower.includes('store') || lower.includes('/state/') || lower.includes('redux') || lower.includes('zustand')) return 'store';
  // Components
  if (lower.includes('/components/') || lower.includes('/pages/') || lower.includes('/views/') || lower.includes('/layouts/')) return 'component';
  // Utils / helpers
  if (lower.includes('/utils/') || lower.includes('/helpers/') || lower.includes('/lib/') || lower.includes('/config/')) return 'util';
  // Styles
  if (lower.endsWith('.css') || lower.endsWith('.scss') || lower.endsWith('.less')) return 'util';
  // Types / interfaces
  if (lower.includes('/types/') || lower.includes('.d.ts')) return 'util';
  // Tests
  if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('__tests__')) return 'util';

  // Fallback: classify by extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (['tsx', 'jsx', 'vue', 'svelte'].includes(ext)) return 'component';
  if (['ts', 'js'].includes(ext)) return 'core';

  return 'util';
}

function getHumanLabel(filePath) {
  const parts = filePath.split('/');
  const filename = parts.pop();
  const name = filename.replace(/\.[^.]+$/, ''); // strip extension

  // Convert camelCase/PascalCase to spaced words
  let label = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[-_]/g, ' ');

  // Capitalize first letter of each word
  label = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  // Add context from parent folder if name is generic
  const genericNames = ['index', 'main', 'app', 'utils', 'helpers', 'types', 'config'];
  if (genericNames.includes(name.toLowerCase()) && parts.length > 0) {
    const parent = parts[parts.length - 1];
    const parentLabel = parent.charAt(0).toUpperCase() + parent.slice(1);
    label = `${parentLabel} ${label}`;
  }

  return label;
}

function extractImports(content, filePath) {
  const imports = [];

  // ES6: import ... from '...' or import '...'
  const esImportRegex = /import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = esImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // CommonJS: require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Dynamic import: import('...')
  const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Python: from X import Y, import X
  if (filePath.endsWith('.py')) {
    const pyFromRegex = /from\s+(\S+)\s+import/g;
    while ((match = pyFromRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    const pyImportRegex = /^import\s+(\S+)/gm;
    while ((match = pyImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function resolveImportPath(importPath, sourceFile, allFilePaths) {
  // Skip external packages (no ./ or ../ prefix and not a relative path)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const sourceDir = path.dirname(sourceFile);
  let resolved = path.normalize(path.join(sourceDir, importPath));

  // Try exact match first
  if (allFilePaths.has(resolved)) return resolved;

  // Try with extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py'];
  for (const ext of extensions) {
    if (allFilePaths.has(resolved + ext)) return resolved + ext;
  }

  // Try /index with extensions
  for (const ext of extensions) {
    const indexPath = path.join(resolved, 'index' + ext);
    if (allFilePaths.has(indexPath)) return indexPath;
  }

  return null;
}

function buildDependencyGraph(files, fileContents) {
  const allFilePaths = new Set(files.map(f => f.path));
  const nodes = [];
  const edges = [];
  const nodeMap = new Map(); // path -> node id

  // Create nodes for all code files
  for (const file of files) {
    if (!isCodeFile(file.path)) continue;

    const id = file.path.replace(/[^a-zA-Z0-9]/g, '_');
    const node = {
      id,
      path: file.path,
      label: getHumanLabel(file.path),
      type: categorizeFile(file.path),
      imports: [],
      importedBy: []
    };
    nodes.push(node);
    nodeMap.set(file.path, id);
  }

  // Build edges from actual imports
  for (const file of files) {
    if (!isCodeFile(file.path)) continue;
    const content = fileContents.get(file.path);
    if (!content) continue;

    const sourceId = nodeMap.get(file.path);
    if (!sourceId) continue;

    const imports = extractImports(content, file.path);

    for (const imp of imports) {
      const resolved = resolveImportPath(imp, file.path, allFilePaths);
      if (!resolved) continue;

      const targetId = nodeMap.get(resolved);
      if (!targetId || targetId === sourceId) continue;

      // Avoid duplicate edges
      const edgeKey = `${sourceId}->${targetId}`;
      if (!edges.some(e => `${e.source}->${e.target}` === edgeKey)) {
        edges.push({ source: sourceId, target: targetId });
      }

      // Track import relationships
      const sourceNode = nodes.find(n => n.id === sourceId);
      const targetNode = nodes.find(n => n.id === targetId);
      if (sourceNode) sourceNode.imports.push(targetId);
      if (targetNode) targetNode.importedBy.push(sourceId);
    }
  }

  return { nodes, edges };
}

function getModuleName(filePath) {
  const parts = filePath.split('/');
  
  // Top-level files -> "Root"
  if (parts.length === 1) return 'Root';

  // Use first meaningful directory
  const topDir = parts[0].toLowerCase();

  // Common monorepo patterns
  if (topDir === 'api' || topDir === 'server' || topDir === 'backend') {
    if (parts.length >= 3) {
      const subDir = parts[1].toLowerCase();
      if (subDir === 'routes' || subDir === 'controllers') return 'API Routes';
      if (subDir === 'utils' || subDir === 'helpers' || subDir === 'lib') return 'API Utilities';
      if (subDir === 'middleware') return 'Middleware';
      if (subDir === 'models') return 'Data Models';
      if (subDir === 'services') return 'Backend Services';
    }
    return 'API Server';
  }

  if (topDir === 'client' || topDir === 'frontend' || topDir === 'app') {
    if (parts.length >= 3) {
      // Dig deeper for src patterns
      const remaining = parts.slice(1).join('/').toLowerCase();
      if (remaining.includes('components')) return 'UI Components';
      if (remaining.includes('pages') || remaining.includes('views')) return 'Pages';
      if (remaining.includes('context') || remaining.includes('store') || remaining.includes('state')) return 'State Management';
      if (remaining.includes('hooks')) return 'Custom Hooks';
      if (remaining.includes('utils') || remaining.includes('lib') || remaining.includes('helpers')) return 'Client Utilities';
      if (remaining.includes('styles') || remaining.includes('css')) return 'Styles';
      if (remaining.includes('types')) return 'Type Definitions';
      if (remaining.includes('services') || remaining.includes('api')) return 'Client API Layer';
    }
    return 'Client App';
  }

  if (topDir === 'src') {
    if (parts.length >= 2) {
      const subDir = parts[1].toLowerCase();
      if (subDir === 'components') return 'UI Components';
      if (subDir === 'pages' || subDir === 'views') return 'Pages';
      if (subDir === 'context' || subDir === 'store' || subDir === 'state') return 'State Management';
      if (subDir === 'hooks') return 'Custom Hooks';
      if (subDir === 'utils' || subDir === 'lib' || subDir === 'helpers') return 'Utilities';
      if (subDir === 'services' || subDir === 'api') return 'API Layer';
      if (subDir === 'styles' || subDir === 'css') return 'Styles';
      if (subDir === 'types') return 'Type Definitions';
    }
    return 'Source';
  }

  // Fallback
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
}

function buildHighLevelArchitecture(nodes, edges) {
  // Group files into modules
  const moduleMap = new Map(); // moduleName -> { files: [], id }
  
  nodes.forEach(node => {
    const moduleName = getModuleName(node.path);
    if (!moduleMap.has(moduleName)) {
      moduleMap.set(moduleName, {
        id: moduleName.toLowerCase().replace(/\s+/g, '-'),
        label: moduleName,
        files: [],
        fileCount: 0
      });
    }
    const mod = moduleMap.get(moduleName);
    mod.files.push(node.id);
    mod.fileCount++;
  });

  // Build node-to-module lookup
  const nodeToModule = new Map();
  moduleMap.forEach((mod, name) => {
    mod.files.forEach(fileId => nodeToModule.set(fileId, mod.id));
  });

  // Build module-level edges from file-level edges
  const moduleEdgeSet = new Set();
  const moduleEdgeCounts = new Map(); // "source->target" -> count
  edges.forEach(e => {
    const sourceModule = nodeToModule.get(e.source);
    const targetModule = nodeToModule.get(e.target);
    if (sourceModule && targetModule && sourceModule !== targetModule) {
      const key = `${sourceModule}->${targetModule}`;
      moduleEdgeSet.add(key);
      moduleEdgeCounts.set(key, (moduleEdgeCounts.get(key) || 0) + 1);
    }
  });

  const moduleNodes = Array.from(moduleMap.values()).map(mod => ({
    id: mod.id,
    label: mod.label,
    fileCount: mod.fileCount
  }));

  const moduleEdges = Array.from(moduleEdgeSet).map(key => {
    const [source, target] = key.split('->');
    return { source, target, weight: moduleEdgeCounts.get(key) || 1 };
  });

  return { moduleNodes, moduleEdges };
}

// ---- Routes ----

router.get('/structure/metrics', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    const cached = await getMetrics(owner, repo);
    if (cached) {
      return res.json(cached);
    }
    res.json({ totalFiles: 0, codeFiles: 0, complexity: 0, codeSmells: [], lastAnalyzed: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/structure/refresh-metrics', async (req, res) => {
  const { owner, repo, technicalLevel = 'medium' } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
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

      codeFiles = files.filter(f => isCodeFile(f.path)).length;
    } catch (githubError) {
      console.log('GitHub tree API failed:', githubError.message);
    }

    let recentHistory = null;
    let direction = null;
    let description = null;

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

      const openai = getOpenAI();
      const overviewCompletion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: getOverviewPrompt(technicalLevel) },
          { role: 'user', content: 'Recent commits:\n' + JSON.stringify(recentCommitsContext, null, 2) }
        ]
      });

      try {
        const rawOverview = overviewCompletion.choices[0].message.content;
        const parsed = safeJsonParse(rawOverview);
        if (parsed) {
          description = parsed.description;
          recentHistory = parsed.recentHistory;
          direction = parsed.direction;
        }
      } catch (e) {
        console.error('Failed to parse overview:', e);
      }

      const { data: allCommits } = await octokit.repos.listCommits({
        owner,
        repo,
        per_page: 1
      });
      const commitCount = allCommits.length;

      await setLastAnalysis(owner, repo, commitCount, commits[0]?.sha,
        { description, recentHistory, direction },
        { totalFiles, codeFiles, complexity: 0, codeSmells: [] }
      );
    } catch (aiError) {
      console.error('AI overview failed:', aiError.message);
    }

    res.json({ totalFiles, codeFiles, description, recentHistory, direction });
  } catch (error) {
    console.error('Refresh metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/structure/overview', async (req, res) => {
  const { owner, repo, technicalLevel } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  const level = technicalLevel || 'medium';

  try {
    const lastAnalysis = await getLastAnalysis(owner, repo);

    let topLanguages = [];
    let description = lastAnalysis?.description || null;
    let recentHistory = lastAnalysis?.recentHistory || null;
    let direction = lastAnalysis?.direction || null;

    try {
      const { data: tree } = await octokit.git.getTree({
        owner,
        repo,
        tree_sha: 'HEAD',
        recursive: 'true'
      });

      const files = tree.tree.filter(f => f.type === 'blob');

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

    const shouldRegenerate = !lastAnalysis || technicalLevel;

    if (shouldRegenerate) {
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

        const openai = getOpenAI();
        const overviewCompletion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: getOverviewPrompt(level) },
            { role: 'user', content: 'Recent commits:\n' + JSON.stringify(recentCommitsContext, null, 2) }
          ]
        });

        try {
          const rawOverview = overviewCompletion.choices[0].message.content;
          const parsed = safeJsonParse(rawOverview);
          if (parsed) {
            description = parsed.description;
            recentHistory = parsed.recentHistory;
            direction = parsed.direction;
          }
        } catch (e) {
          console.error('Failed to parse overview:', e);
        }

        const { data: allCommits } = await octokit.repos.listCommits({
          owner,
          repo,
          per_page: 1
        });
        const commitCount = allCommits.length;

        await setLastAnalysis(owner, repo, commitCount, commits[0]?.sha,
          { description, recentHistory, direction },
          { totalFiles: 0, codeFiles: 0, complexity: 0, codeSmells: [] }
        );
      } catch (aiError) {
        console.error('AI overview generation failed:', aiError.message);
      }
    }

    const response = {
      topLanguages,
      description,
      recentHistory,
      direction
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

router.get('/structure/analysis', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    const analysisData = await getAnalysisData(owner, repo);
    if (!analysisData) {
      return res.json({ analysis: null });
    }
    res.json({ analysis: analysisData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/structure/analyze', async (req, res) => {
  const { owner, repo, forceReindex = false } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    console.log(`[Analyze] Starting analysis for ${owner}/${repo}`);

    // 1. Get full file tree
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true'
    });

    const allTreeFiles = tree.tree.filter(f => f.type === 'blob' && shouldIncludeFile(f.path, f.size || 0));
    const codeTreeFiles = allTreeFiles.filter(f => isCodeFile(f.path));

    console.log(`[Analyze] Found ${allTreeFiles.length} files, ${codeTreeFiles.length} code files`);

    // 2. Fetch file contents (batched)
    const fileContents = new Map();
    const batchSize = 10;
    for (let i = 0; i < codeTreeFiles.length; i += batchSize) {
      const batch = codeTreeFiles.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(async (f) => {
        try {
          const { data } = await octokit.repos.getContent({ owner, repo, path: f.path });
          if (data.type === 'file') {
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            return { path: f.path, content };
          }
        } catch (e) {}
        return null;
      }));
      results.filter(Boolean).forEach(r => fileContents.set(r.path, r.content));
    }

    console.log(`[Analyze] Fetched content for ${fileContents.size} files`);

    // 3. Build deterministic dependency graph
    const { nodes, edges } = buildDependencyGraph(codeTreeFiles, fileContents);

    console.log(`[Analyze] Built graph: ${nodes.length} nodes, ${edges.length} edges`);

    // 4. Use AI for complexity and code smells only
    let cyclomaticComplexity = 0;
    let codeSmells = [];

    try {
      // Build a summary of the codebase for AI analysis
      const fileSummaries = nodes.slice(0, 30).map(n => {
        const content = fileContents.get(n.path);
        const lineCount = content ? content.split('\n').length : 0;
        const importCount = n.imports.length;
        const importedByCount = n.importedBy.length;
        return `${n.path} (${lineCount} lines, imports: ${importCount}, imported by: ${importedByCount})`;
      }).join('\n');

      const openai = getOpenAI();
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a code quality analyst. Given a list of files with their line counts and dependency counts, estimate code quality.

Return ONLY valid JSON with these fields:
1. "cyclomaticComplexity": number from 1-10 (average complexity estimate)
2. "codeSmells": array of up to 5 objects with {type, file, description, severity} where severity is "low", "medium", or "high"

Base your assessment on:
- Files with many imports may have too many responsibilities
- Files imported by many others are critical and should be stable
- Very long files may need splitting
- Files with no imports or importedBy may be dead code`
          },
          {
            role: 'user',
            content: `Analyze these ${nodes.length} code files:\n\n${fileSummaries}`
          }
        ]
      });

      const parsed = safeJsonParse(completion.choices[0].message.content);
      if (parsed) {
        cyclomaticComplexity = parsed.cyclomaticComplexity || 0;
        codeSmells = parsed.codeSmells || [];
      }
    } catch (aiError) {
      console.error('[Analyze] AI assessment failed:', aiError.message);
    }

    // 5. Build high-level architecture
    const { moduleNodes, moduleEdges } = buildHighLevelArchitecture(nodes, edges);
    console.log(`[Analyze] High-level: ${moduleNodes.length} modules, ${moduleEdges.length} module connections`);

    // 6. Build file tree structure (directories with children)
    const dirTree = {};
    nodes.forEach(n => {
      const parts = n.path.split('/');
      let current = dirTree;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) current[parts[i]] = {};
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = { _file: true, id: n.id, type: n.type };
    });

    // 7. Prepare response
    const clientNodes = nodes.map(n => ({
      id: n.id,
      label: n.label,
      type: n.type,
      path: n.path,
      module: getModuleName(n.path),
      imports: n.imports,
      importedBy: n.importedBy
    }));

    const analysis = {
      // File-level graph
      nodes: clientNodes,
      edges,
      // High-level architecture
      moduleNodes,
      moduleEdges,
      // Directory tree
      dirTree,
      // Metrics
      cyclomaticComplexity,
      codeSmells,
      totalFiles: allTreeFiles.length,
      codeFiles: codeTreeFiles.length
    };

    console.log(`[Analyze] Complete. Sending ${clientNodes.length} nodes, ${edges.length} edges`);

    await setAnalysisData(owner, repo, analysis);

    res.json(analysis);
  } catch (error) {
    console.error('Analyze endpoint error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
