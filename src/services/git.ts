import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

let gitClient: AxiosInstance | null = null;
let gitPlatform: 'github' | 'gitlab' | null = null;

function initClient() {
  const platform = process.env.GIT_PLATFORM as 'github' | 'gitlab';
  const token = process.env.GIT_TOKEN;
  let domain = process.env.GIT_DOMAIN;

  if (platform && token) {
    gitPlatform = platform;
    
    let baseURL = '';
    let headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (platform === 'github') {
      baseURL = 'https://api.github.com';
      headers['Authorization'] = `token ${token}`;
    } else {
      const baseDomain = domain ? domain.replace(/\/$/, '') : 'https://gitlab.com';
      baseURL = baseDomain.includes('/api/v4') ? baseDomain : `${baseDomain}/api/v4`;
      headers['PRIVATE-TOKEN'] = token;
    }

    gitClient = axios.create({
      baseURL,
      headers
    });
    return true;
  }
  return false;
}

initClient();

export const gitService = {
  get isGitConfigured() {
    return !!gitClient;
  },

  get platform() {
    return gitPlatform;
  },

  reconfigure() {
    return initClient();
  },

  async getRepositories() {
    if (!gitClient) throw new Error('Git not configured');
    if (gitPlatform === 'github') {
      const response = await gitClient.get('/user/repos', {
        params: { sort: 'updated', per_page: 50, affiliation: 'owner,collaborator' }
      });
      return response.data.map((r: any) => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        owner: r.owner.login,
        description: r.description,
        url: r.html_url,
        stars: r.stargazers_count,
        visibility: r.visibility,
        updatedAt: r.updated_at
      }));
    } else {
      const response = await gitClient.get('/projects', {
        params: { membership: true, order_by: 'updated_at', per_page: 50, simple: true }
      });
      return response.data.map((r: any) => ({
        id: r.id,
        fullName: r.path_with_namespace,
        name: r.path,
        owner: r.namespace.path,
        description: r.description,
        url: r.web_url,
        stars: r.star_count,
        visibility: r.visibility,
        updatedAt: r.last_activity_at || r.updated_at
      }));
    }
  },

  async getBranches(repoIdOrPath: string | number) {
    if (!gitClient) throw new Error('Git not configured');
    const url = gitPlatform === 'github' 
      ? `/repos/${repoIdOrPath}/branches` 
      : `/projects/${encodeURIComponent(repoIdOrPath)}/repository/branches`;
    const response = await gitClient.get(url);
    return response.data.map((b: any) => ({ 
      name: b.name,
      date: b.commit?.committed_date || null 
    }));
  },

  async getCommits(repoIdOrPath: string | number, branch?: string) {
    if (!gitClient) throw new Error('Git not configured');
    if (gitPlatform === 'github') {
      const response = await gitClient.get(`/repos/${repoIdOrPath}/commits`, {
        params: { sha: branch, per_page: 30 }
      });
      return response.data.map((c: any) => ({
        hash: c.sha,
        shortHash: c.sha.substring(0, 8),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author.name,
        date: c.commit.author.date
      }));
    } else {
      const response = await gitClient.get(`/projects/${encodeURIComponent(repoIdOrPath)}/repository/commits`, {
        params: { ref_name: branch, per_page: 30 }
      });
      return response.data.map((c: any) => ({
        hash: c.id,
        shortHash: c.short_id,
        message: c.title,
        author: c.author_name,
        date: c.created_at
      }));
    }
  },

  async getCommitFiles(repoIdOrPath: string | number, sha: string) {
    if (!gitClient) throw new Error('Git not configured');
    if (gitPlatform === 'github') {
      const response = await gitClient.get(`/repos/${repoIdOrPath}/commits/${sha}`);
      return response.data.files.map((f: any) => ({
        path: f.filename,
        status: f.status,
        diff: f.patch || '(No diff content available)'
      }));
    } else {
      const response = await gitClient.get(`/projects/${encodeURIComponent(repoIdOrPath)}/repository/commits/${sha}/diff`);
      return response.data.map((f: any) => ({
        path: f.new_path,
        status: f.new_file ? 'added' : (f.deleted_file ? 'removed' : 'modified'),
        diff: f.diff || '(No diff content available)'
      }));
    }
  },

  async getPullRequests(repoIdOrPath: string | number) {
    if (!gitClient) throw new Error('Git not configured');
    if (gitPlatform === 'github') {
      const response = await gitClient.get(`/repos/${repoIdOrPath}/pulls`, {
        params: { state: 'open', sort: 'updated', direction: 'desc' }
      });
      return response.data.map((pr: any) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        user: pr.user.login,
        status: pr.state,
        url: pr.html_url,
        createdAt: pr.created_at,
        updatedAt: pr.updated_at
      }));
    } else {
      const response = await gitClient.get(`/projects/${encodeURIComponent(repoIdOrPath)}/merge_requests`, {
        params: { state: 'opened', order_by: 'updated_at' }
      });
      return response.data.map((mr: any) => ({
        id: mr.id,
        number: mr.iid,
        title: mr.title,
        user: mr.author.username,
        status: mr.state,
        url: mr.web_url,
        createdAt: mr.created_at,
        updatedAt: mr.updated_at
      }));
    }
  }
};
