const { supabase } = require('./supabase');

async function getLastAnalysis(owner, repo) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('repo_analysis')
    .select('*')
    .eq('repo', `${owner}/${repo}`)
    .single();

  if (error || !data) return null;
  return {
    lastAnalyzed: data.last_analyzed,
    commitCount: data.commit_count,
    commitSha: data.commit_sha,
    description: data.description,
    recentHistory: data.recent_history,
    direction: data.direction
  };
}

async function setLastAnalysis(owner, repo, commitCount, commitSha = null, overviewData = {}) {
  if (!supabase) return;

  const { error } = await supabase
    .from('repo_analysis')
    .upsert({
      repo: `${owner}/${repo}`,
      last_analyzed: new Date().toISOString(),
      commit_count: commitCount,
      commit_sha: commitSha,
      description: overviewData.description || null,
      recent_history: overviewData.recentHistory || null,
      direction: overviewData.direction || null
    }, {
      onConflict: 'repo'
    });

  if (error) console.error('Failed to save analysis state:', error);
}

async function getAnalysisData(owner, repo) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('repo_analysis')
    .select('analysis_data')
    .eq('repo', `${owner}/${repo}`)
    .single();

  if (error || !data) return null;
  return data.analysis_data;
}

async function setAnalysisData(owner, repo, analysisData) {
  if (!supabase) return;

  const { error } = await supabase
    .from('repo_analysis')
    .update({ analysis_data: analysisData })
    .eq('repo', `${owner}/${repo}`);

  if (error) console.error('Failed to save analysis data:', error);
}

async function getOverviewData(owner, repo) {
  if (!supabase) {
    console.log('getOverviewData: Supabase not configured');
    return null;
  }

  const repoKey = `${owner}/${repo}`;
  console.log('getOverviewData: querying for', repoKey);
  
  const { data, error } = await supabase
    .from('repo_analysis')
    .select('description, recent_history, direction')
    .eq('repo', repoKey)
    .single();

  console.log('getOverviewData: result:', { data, error });

  if (error || !data) {
    console.log('getOverviewData: no data found');
    return null;
  }
  return {
    description: data.description,
    recentHistory: data.recent_history,
    direction: data.direction
  };
}

module.exports = { getLastAnalysis, setLastAnalysis, getAnalysisData, setAnalysisData, getOverviewData };
