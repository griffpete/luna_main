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
    direction: data.direction,
    totalFiles: data.total_files,
    codeFiles: data.code_files,
    complexity: data.complexity,
    codeSmells: data.code_smells
  };
}

async function setLastAnalysis(owner, repo, commitCount, commitSha = null, overviewData = {}, metricsData = {}) {
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
      direction: overviewData.direction || null,
      total_files: metricsData.totalFiles || 0,
      code_files: metricsData.codeFiles || 0,
      complexity: metricsData.complexity || 0,
      code_smells: metricsData.codeSmells || []
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

async function getMetrics(owner, repo) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('repo_analysis')
    .select('total_files, code_files, complexity, code_smells, last_analyzed')
    .eq('repo', `${owner}/${repo}`)
    .single();

  if (error || !data) return null;
  return {
    totalFiles: data.total_files,
    codeFiles: data.code_files,
    complexity: data.complexity,
    codeSmells: data.code_smells,
    lastAnalyzed: data.last_analyzed
  };
}

module.exports = { getLastAnalysis, setLastAnalysis, getAnalysisData, setAnalysisData, getOverviewData, getMetrics };
