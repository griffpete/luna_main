const express = require('express');
const { supabase } = require('../utils/supabase');

const router = express.Router();

router.get('/favorites', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured', favorites: [] });

  try {
    const { data, error } = await supabase
      .from('repo_favorites')
      .select('repo')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ favorites: data.map(f => f.repo) });
  } catch (error) {
    res.status(500).json({ error: error.message, favorites: [] });
  }
});

router.post('/favorites', async (req, res) => {
  const { repo } = req.body;
  if (!repo) return res.status(400).json({ error: 'repo is required' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const { error } = await supabase
      .from('repo_favorites')
      .upsert({ repo }, { onConflict: 'repo' });

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/favorites', async (req, res) => {
  const { repo } = req.body;
  if (!repo) return res.status(400).json({ error: 'repo is required' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const { error } = await supabase
      .from('repo_favorites')
      .delete()
      .eq('repo', repo);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
