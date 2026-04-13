import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

let jiraClient: AxiosInstance | null = null;

function initClient() {
  const domain = process.env.JIRA_DOMAIN;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (domain && email && token) {
    const auth = Buffer.from(`${email}:${token}`).toString('base64');
    
    jiraClient = axios.create({
      baseURL: `${domain.replace(/\/$/, '')}`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });
    return true;
  }
  return false;
}

initClient();

export const jiraService = {
  get isConfigured() {
    return !!jiraClient;
  },

  reconfigure() {
    return initClient();
  },
  
  async getProjects() {
    if (!jiraClient) throw new Error('Jira not configured');
    const response = await jiraClient.get('/rest/api/3/project');
    return response.data;
  },

  async getBoards(projectKeyOrId?: string) {
    if (!jiraClient) throw new Error('Jira not configured');
    const params = projectKeyOrId ? { projectKeyOrId } : {};
    const response = await jiraClient.get('/rest/agile/1.0/board', { params });
    return response.data.values;
  },

  async getIssues(boardId: number) {
    if (!jiraClient) throw new Error('Jira not configured');
    const response = await jiraClient.get(`/rest/agile/1.0/board/${boardId}/issue`);
    return response.data.issues;
  },

  async getIssue(issueIdOrKey: string) {
    if (!jiraClient) throw new Error('Jira report not configured');
    const response = await jiraClient.get(`/rest/api/3/issue/${issueIdOrKey}`);
    return response.data;
  },

  async getComments(issueIdOrKey: string) {
    if (!jiraClient) throw new Error('Jira not configured');
    const response = await jiraClient.get(`/rest/api/3/issue/${issueIdOrKey}/comment`);
    return response.data.comments;
  },

  async addComment(issueIdOrKey: string, body: string) {
    if (!jiraClient) throw new Error('Jira not configured');
    const response = await jiraClient.post(`/rest/api/3/issue/${issueIdOrKey}/comment`, {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: body
              }
            ]
          }
        ]
      }
    });
    return response.data;
  },

  async getTransitions(issueIdOrKey: string) {
    if (!jiraClient) throw new Error('Jira not configured');
    const response = await jiraClient.get(`/rest/api/3/issue/${issueIdOrKey}/transitions`);
    return response.data.transitions;
  },

  async doTransition(issueIdOrKey: string, transitionId: string) {
    if (!jiraClient) throw new Error('Jira not configured');
    await jiraClient.post(`/rest/api/3/issue/${issueIdOrKey}/transitions`, {
      transition: { id: transitionId }
    });
  }
};
