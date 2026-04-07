require('dotenv').config();
const express = require('express');
const { Octokit } = require('@octokit/rest');
const OpenAI = require('openai');
const { OpenAIEmbeddings, ChatOpenAI } = require('@langchain/openai');
const { Chroma } = require('@langchain/community/vectorstores/chroma');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

const app = express();
app.use(express.json());

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const openai = new OpenAI({ apiKey: process.env.OPENAI_TOKEN });
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_TOKEN });

app.post('/index', async (req, res) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {
    // 1. CLEAR EXISTING DATA (The "Nuke")
    // We connect to the old collection just to delete it
    try {
      const oldStore = await Chroma.fromExistingCollection(embeddings, {
        collectionName: `${owner}-${repo}`,
        host: 'localhost',
        port: 8000
      });
      await oldStore.deleteCollection();
      console.log(`Cleared old data for ${owner}-${repo}`);
    } catch (e) {
      // If collection doesn't exist yet, just ignore the error and move on
    }

    // 2. FETCH THE FILES (With your new filters)
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: 'HEAD',
      recursive: 'true'
    });

    const files = tree.tree.filter(f => {
      const isBlob = f.type === 'blob';
      const path = f.path.toLowerCase();

      // 1. BLOCKED FOLDERS (Common dependencies/build artifacts)
      const blockedFolders = ['node_modules', 'dist', 'build', '.next', '.git', 'venv', '__pycache__'];
      const isInBlockedFolder = blockedFolders.some(folder => path.includes(`${folder}/`));

      // 2. BLOCKED EXTENSIONS (Binary, Media, and Bloat)
      const blockedExts = ['.db', '.sqlite', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.zip', '.pdf', '.exe', '.lock', '.ds_store', '.map'];
      const isBlockedExt = blockedExts.some(ext => path.endsWith(ext));

      // 3. HIDDEN FILES (Anything starting with a dot, like .DS_Store or .env)
      const isHidden = f.path.split('/').some(part => part.startsWith('.'));

      // Logic: Must be a blob, NOT in a blocked folder, NOT a blocked extension, and NOT hidden
      return isBlob && !isInBlockedFolder && !isBlockedExt && !isHidden && f.size < 100000;
    });
    console.log(`TOTAL FILES TO INDEX: ${files.length}`);

    // 3. FETCH CONTENT & SPLIT
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

    // 4. CREATE FRESH COLLECTION
    await Chroma.fromDocuments(chunks, embeddings, {
      collectionName: `${owner}-${repo}`,
      host: 'localhost',
      port: 8000
    });

    res.json({ indexed: chunks.length, files: files.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/chat', async (req, res) => {
  const { owner, repo, question } = req.body;
  if (!owner || !repo || !question) return res.status(400).json({ error: 'owner, repo and question are required' });

  try {
    const vectorstore = await Chroma.fromExistingCollection(embeddings, {
      collectionName: `${owner}-${repo}`,
      host: 'localhost',
      port: 8000
    });

    const results = await vectorstore.similaritySearch(question, 5);

    const context = results.map(r => `File: ${r.metadata.path}\n${r.pageContent}`).join('\n\n---\n\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that answers questions about a code repository. Use the provided code context to answer. If the answer isn't in the context, say so.`
        },
        {
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${question}`
        }
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

app.post('/commit', async (req, res) => {
  if (!req.body) return res.sendStatus(400)
  const owner = req.body.owner;
  const repo = req.body.repo;

  if (!owner || !repo) {
    return res.status(400).json({ error: 'owner and repo are required' });
  }

  try {
    const { data } = await octokit.repos.listCommits({
      owner: owner,
      repo: repo,
      per_page: 1
    });

    const latestCommit = data[0];

    const { data: commitDetails } = await octokit.repos.getCommit({
      owner: owner,
      repo: repo,
      ref: latestCommit.sha
    });

    const filesChanged = commitDetails.files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch
    }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: `Explain what changed in this commit in plain English:

Commit message: ${latestCommit.commit.message}

Files changed:
${JSON.stringify(filesChanged, null, 2)}

Explain what was changes any why, this is for non technical team members so dumb it down
keep it to 1-2 sentances, but no longer than that.`
        }
      ]
    });

    const explanation = completion.choices[0].message.content;

    res.json({
      commit: {
        sha: latestCommit.sha,
        message: latestCommit.commit.message,
        author: latestCommit.commit.author.name,
        date: latestCommit.commit.author.date,
        url: latestCommit.html_url
      },
      filesChanged: filesChanged.length,
      aiExplanation: explanation
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
