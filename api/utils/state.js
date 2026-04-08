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
    commitSha: data.commit_sha
  };
}

async function setLastAnalysis(owner, repo, commitCount, commitSha = null) {
  if (!supabase) return;

  const { error } = await supabase
    .from('repo_analysis')
    .upsert({
      repo: `${owner}/${repo}`,
      last_analyzed: new Date().toISOString(),
      commit_count: commitCount,
      commit_sha: commitSha
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

module.exports = { getLastAnalysis, setLastAnalysis, getAnalysisData, setAnalysisData };
