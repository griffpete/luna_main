const express = require('express');
const { Octokit } = require('@octokit/rest');

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

let openai;

function getOpenAI() {
  if (!openai) {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_TOKEN });
  }
  return openai;
}

router.post('/commit', async (req, res) => {
  const { owner, repo } = req.body;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });

  try {

    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: 1
    });

    const latestCommit = data[0];

    const { data: commitDetails } = await octokit.repos.getCommit({
      owner,
      repo,
      ref: latestCommit.sha
    });

    const filesChanged = commitDetails.files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: file.patch
    }));

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-3.5-turbo",
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

module.exports = router;
