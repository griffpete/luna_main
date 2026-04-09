const express = require('express');
const { Octokit } = require('@octokit/rest');

const router = express.Router();
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

router.get('/repos', async (req, res) => {
  if (!process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not configured', repos: [] });

  try {
    const { data } = await octokit.repos.listForAuthenticatedUser({
      type: 'owner',
      sort: 'updated',
      per_page: 100
    });

    res.json({
      repos: data.map(r => ({
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        private: r.private,
        url: r.html_url
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/stats', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });
  if (!process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not configured', stats: null });

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [commitsResult, contributorsResult, pullsResult] = await Promise.all([
      octokit.repos.listCommits({ owner, repo, since: thirtyDaysAgo.toISOString(), per_page: 100 }),
      octokit.repos.listContributors({ owner, repo, per_page: 100 }),
      octokit.pulls.list({ owner, repo, state: 'open', per_page: 100 })
    ]);

    const commits = commitsResult.data;
    const contributors = contributorsResult.data;
    const pulls = pullsResult.data;

    const contributorsLast30d = new Set(
      commits.map(c => c.author?.login).filter(Boolean)
    ).size;

    res.json({
      totalCommits30d: commits.length,
      activeContributors: contributorsLast30d,
      totalContributors: contributors.length,
      openPullRequests: pulls.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/commits', async (req, res) => {
  const { owner, repo, limit = 20 } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });
  if (!process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not configured', commits: [] });

  try {
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      per_page: parseInt(limit)
    });

    const formattedCommits = data.map(commit => {
      const type = commit.commit.message.match(/^(\w+)(\([^)]+\))?:/);
      return {
        sha: commit.sha.substring(0, 8),
        message: commit.commit.message.split('\n')[0],
        author: commit.commit.author.name,
        date: commit.commit.author.date,
        url: commit.html_url,
        type: type ? type[1] : 'chore',
        additions: commit.stats?.additions || 0,
        deletions: commit.stats?.deletions || 0
      };
    });

    res.json({ commits: formattedCommits });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/contributors', async (req, res) => {
  const { owner, repo } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });
  if (!process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not configured', contributors: [] });

  try {
    const { data } = await octokit.repos.listContributors({
      owner,
      repo,
      per_page: 100
    });

    res.json({
      contributors: data.map(c => ({
        login: c.login,
        contributions: c.contributions,
        avatar: c.avatar_url
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/activity', async (req, res) => {
  const { owner, repo, days = 30 } = req.query;
  if (!owner || !repo) return res.status(400).json({ error: 'owner and repo are required' });
  if (!process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not configured', activity: [] });

  const numDays = parseInt(days);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - numDays);

  try {
    const { data: commits } = await octokit.repos.listCommits({
      owner,
      repo,
      since: cutoffDate.toISOString(),
      per_page: 500
    });

    const activityData = {};

    if (numDays <= 30) {
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`;
        activityData[key] = { name: key, commits: 0, additions: 0, deletions: 0 };
      }

      commits.forEach(commit => {
        const date = new Date(commit.commit.author.date);
        const key = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
        if (activityData[key]) {
          activityData[key].commits++;
          activityData[key].additions += commit.stats?.additions || 0;
          activityData[key].deletions += commit.stats?.deletions || 0;
        }
      });
    } else {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthsNeeded = Math.ceil(numDays / 30);

      for (let i = monthsNeeded - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = monthNames[d.getMonth()];
        activityData[key] = { name: key, commits: 0, additions: 0, deletions: 0 };
      }

      commits.forEach(commit => {
        const date = new Date(commit.commit.author.date);
        const key = monthNames[date.getMonth()];
        if (activityData[key]) {
          activityData[key].commits++;
          activityData[key].additions += commit.stats?.additions || 0;
          activityData[key].deletions += commit.stats?.deletions || 0;
        }
      });
    }

    res.json({ activity: Object.values(activityData) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
