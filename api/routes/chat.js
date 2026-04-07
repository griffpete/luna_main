const express = require('express');
const { Octokit } = require('@octokit/rest');
const { OpenAIEmbeddings } = require('@langchain/openai');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

let openai, embeddings;

function getOpenAI() {
  if (!openai) {
    const OpenAI = require('openai');
    console.log('OPENAI_TOKEN env:', process.env.OPENAI_TOKEN ? 'set' : 'NOT SET');
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

router.post('/index', async (req, res) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
  try {
    const embeddings = getEmbeddings();
    const oldStore = await Chroma.fromExistingCollection(embeddings, {
        collectionName: `${owner}-${repo}`,
        host: 'localhost',
        port: 8000
      });
      await oldStore.deleteCollection();
      console.log(`Cleared old data for ${owner}-${repo}`);
    } catch (e) {}

    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true'
    });

    const files = tree.tree.filter(f => {
      const isBlob = f.type === 'blob';
      const path = f.path.toLowerCase();
      const blockedFolders = ['node_modules', 'dist', 'build', '.next', '.git', 'venv', '__pycache__'];
      const isInBlockedFolder = blockedFolders.some(folder => path.includes(`${folder}/`));
      const blockedExts = ['.db', '.sqlite', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.zip', '.pdf', '.exe', '.lock', '.ds_store', '.map'];
      const isBlockedExt = blockedExts.some(ext => path.endsWith(ext));
      const isHidden = f.path.split('/').some(part => part.startsWith('.'));
      return isBlob && !isInBlockedFolder && !isBlockedExt && !isHidden && f.size < 100000;
    });

    const docs = [];
    for (const file of files) {
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: file.path });
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        docs.push({ pageContent: content, metadata: { path: file.path, repo: `${owner}/${repo}` } });
      } catch (e) { continue; }
    }

    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
    const chunks = await splitter.splitDocuments(docs);

    await Chroma.fromDocuments(chunks, getEmbeddings(), {
      collectionName: `${owner}-${repo}`,
      host: 'localhost',
      port: 8000
    });

    res.json({ indexed: chunks.length, files: files.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/chat', async (req, res) => {
  const { owner, repo, question } = req.body;
  if (!owner || !repo || !question) return res.status(400).json({ error: 'owner, repo and question are required' });

  try {
    const vectorstore = await Chroma.fromExistingCollection(getEmbeddings(), {
      collectionName: `${owner}-${repo}`,
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
