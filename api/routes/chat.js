const express = require('express');
const { Octokit } = require('@octokit/rest');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

let openai, embeddings;

function getCollectionName(owner, repo) {
  return `${owner}_${repo}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getOpenAI() {
  if (!openai) {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_TOKEN });
  }
  return openai;
}

function getEmbeddings() {
  if (!embeddings) {
    embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_TOKEN });
  }
  return embeddings;
}

async function deleteCollectionIfExists(collectionName) {
  const { default: { ChromaClient } = await import('chromadb') } = await import('@langchain/community');
  const client = new ChromaClient({ path: 'http://localhost:8000' });
  
  try {
    const collection = await client.getCollection({ name: collectionName });
    await client.deleteCollection({ name: collectionName });
    console.log(`Deleted existing collection: ${collectionName}`);
    return true;
  } catch (e) {
    return false;
  }
}

async function fetchFileContent(owner, repo, path, signal) {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path }, { signal });
    if (data.type === 'file') {
      return {
        pageContent: Buffer.from(data.content, 'base64').toString('utf-8'),
        metadata: { path, repo: `${owner}/${repo}` }
      };
    }
  } catch (e) {
    if (e.name !== 'AbortError') console.warn(`Failed to fetch ${path}: ${e.message}`);
  }
  return null;
}

router.post('/index', async (req, res) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  const collectionName = getCollectionName(owner, repo);
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    await deleteCollectionIfExists(collectionName);

    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true'
    });

    const files = tree.tree.filter(f => {
      if (f.type !== 'blob') return false;
      const path = f.path.toLowerCase();
      const blockedFolders = ['node_modules', 'dist', 'build', '.next', '.git', 'venv', '__pycache__'];
      if (blockedFolders.some(folder => path.includes(`${folder}/`))) return false;
      const blockedExts = ['.db', '.sqlite', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.zip', '.pdf', '.exe', '.lock', '.ds_store', '.map'];
      if (blockedExts.some(ext => path.endsWith(ext))) return false;
      if (f.path.split('/').some(part => part.startsWith('.'))) return false;
      return f.size < 100000;
    });

    console.log(`Fetching content for ${files.length} files...`);
    
    const batchSize = 10;
    const docs = [];
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(f => fetchFileContent(owner, repo, f.path, controller.signal))
      );
      docs.push(...results.filter(Boolean));
      
      if ((i + batchSize) % 50 === 0) {
        console.log(`Processed ${Math.min(i + batchSize, files.length)}/${files.length} files`);
      }
    }

    console.log(`Splitting ${docs.length} documents...`);
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const chunks = await splitter.splitDocuments(docs);

    console.log(`Creating collection with ${chunks.length} chunks...`);
    await Chroma.fromDocuments(chunks, getEmbeddings(), {
      collectionName,
      host: 'localhost',
      port: 8000
    });

    res.json({ indexed: chunks.length, files: files.length });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(499).json({ error: 'Request cancelled' });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  const { owner, repo, question } = req.body;
  if (!owner || !repo || !question) return res.status(400).json({ error: 'owner, repo and question are required' });

  const collectionName = getCollectionName(owner, repo);

  try {
    const vectorstore = await Chroma.fromExistingCollection(getEmbeddings(), {
      collectionName,
      host: 'localhost',
      port: 8000
    });

    const results = await vectorstore.similaritySearch(question, 5);
    const context = results.map(r => `File: ${r.metadata.path}\n${r.pageContent}`).join('\n\n---\n\n');

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: `You are a helpful assistant that answers questions about a code repository. Use the provided code context to answer. If the answer isn't in the context, say so.` },
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${question}` }
      ]
    });

    res.json({
      answer: completion.choices[0].message.content,
      sources: results.map(r => r.metadata.path)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
