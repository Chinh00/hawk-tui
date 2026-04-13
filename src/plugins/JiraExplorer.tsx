import React, { useState, useEffect } from 'react';
import { Text, Box, Newline, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { jiraService } from '../services/jira.js';
import { updateEnv } from '../utils/env.js';
import { ToolPluginProps } from './types.js';

type ViewState = 'PROJECTS' | 'BOARDS' | 'ISSUES' | 'ISSUE_DETAIL' | 'TRANSITION' | 'CONFIG';

export const JiraExplorer: React.FC<ToolPluginProps> = ({ activeSubMenuId, isFocused }) => {
  const [view, setView] = useState<ViewState>('PROJECTS');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Config state
  const [configStep, setConfigStep] = useState(0);
  const [configData, setConfigData] = useState({
    JIRA_DOMAIN: process.env.JIRA_DOMAIN || '',
    JIRA_EMAIL: process.env.JIRA_EMAIL || '',
    JIRA_API_TOKEN: process.env.JIRA_API_TOKEN || ''
  });
  const [configStatus, setConfigStatus] = useState<string | null>(null);

  const [projects, setProjects] = useState<any[]>([]);
  const [boards, setBoards] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [transitions, setTransitions] = useState<any[]>([]);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProjectId, setSelectedProject] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoard] = useState<number | null>(null);
  
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  useEffect(() => {
    if (activeSubMenuId === 'config') {
      setView('CONFIG');
      setConfigStep(0);
      setConfigStatus(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!jiraService.isConfigured) {
      setError('Jira not configured. Use Config menu to set JIRA_DOMAIN, EMAIL, and API_TOKEN.');
      setLoading(false);
      return;
    }
    loadProjects();
  }, [activeSubMenuId]);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jiraService.getProjects();
      setProjects(data);
      setView('PROJECTS');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load projects: ${err.message}`);
      setLoading(false);
    }
  };

  const loadBoards = async (projectKey: string) => {
    setLoading(true);
    try {
      const data = await jiraService.getBoards(projectKey);
      setBoards(data);
      setView('BOARDS');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load boards: ${err.message}`);
      setLoading(false);
    }
  };

  const loadIssues = async (boardId: number) => {
    setLoading(true);
    try {
      const data = await jiraService.getIssues(boardId);
      setIssues(data);
      setView('ISSUES');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load issues: ${err.message}`);
      setLoading(false);
    }
  };

  const loadIssueDetail = async (issueKey: string) => {
    setLoading(true);
    try {
      const [issue, comms, trans] = await Promise.all([
        jiraService.getIssue(issueKey),
        jiraService.getComments(issueKey),
        jiraService.getTransitions(issueKey)
      ]);
      setSelectedIssue(issue);
      setComments(comms || []);
      setTransitions(trans || []);
      setView('ISSUE_DETAIL');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load issue detail: ${err.message}`);
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      await jiraService.addComment(selectedIssue.key, newComment);
      const updatedComms = await jiraService.getComments(selectedIssue.key);
      setComments(updatedComms);
      setNewComment('');
      setIsAddingComment(false);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to add comment: ${err.message}`);
      setLoading(false);
    }
  };

  const handleTransition = async (transitionId: string) => {
    setLoading(true);
    try {
      await jiraService.doTransition(selectedIssue.key, transitionId);
      await loadIssueDetail(selectedIssue.key);
    } catch (err: any) {
      setError(`Failed to transition issue: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    try {
      updateEnv(configData);
      jiraService.reconfigure();
      setConfigStatus('✅ Configuration saved and reloaded!');
      setTimeout(() => {
        if (jiraService.isConfigured) {
          loadProjects();
        }
      }, 1500);
    } catch (err: any) {
      setError(`Failed to save config: ${err.message}`);
    }
  };

  useInput((input, key) => {
    if (!isFocused || loading || error || isAddingComment) {
      if (error && key.escape) setError(null);
      return;
    }

    if (view === 'CONFIG') {
      if (key.escape) {
        if (jiraService.isConfigured) loadProjects();
        else setView('PROJECTS');
      }
      return;
    }

    const items = 
      view === 'PROJECTS' ? projects : 
      view === 'BOARDS' ? boards : 
      view === 'ISSUES' ? issues : 
      view === 'TRANSITION' ? transitions : [];

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));
    }
    if (key.return) {
      if (view === 'PROJECTS') {
        const p = projects[selectedIndex];
        setSelectedProject(p.key);
        loadBoards(p.key);
      } else if (view === 'BOARDS') {
        const b = boards[selectedIndex];
        setSelectedBoard(b.id);
        loadIssues(b.id);
      } else if (view === 'ISSUES') {
        loadIssueDetail(issues[selectedIndex].key);
      } else if (view === 'TRANSITION') {
        handleTransition(transitions[selectedIndex].id);
      }
    }
    if (input === 'b' || key.escape) {
      if (view === 'BOARDS') loadProjects();
      else if (view === 'ISSUES') loadBoards(selectedProjectId!);
      else if (view === 'ISSUE_DETAIL' || view === 'TRANSITION') loadIssues(selectedBoardId!);
    }
    if (view === 'ISSUE_DETAIL') {
      if (input === 'c') setIsAddingComment(true);
      if (input === 'm') {
        setView('TRANSITION');
        setSelectedIndex(0);
      }
    }
  });

  if (error) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="red">
        <Text color="red" bold>⚠️ Jira Error</Text>
        <Newline />
        <Text>{error}</Text>
        <Text color="gray" marginTop={1}>Press ESC to clear error</Text>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box padding={1}>
        <Text color="blue">📡 Communicating with Jira Cloud...</Text>
      </Box>
    );
  }

  if (view === 'CONFIG') {
    const fields = ['JIRA_DOMAIN', 'JIRA_EMAIL', 'JIRA_API_TOKEN'] as const;
    const currentField = fields[configStep];

    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow" flexGrow={1}>
        <Text bold color="yellow">⚙️ Jira Configuration</Text>
        <Box height={1} />
        
        {configStatus ? (
          <Text color="green">{configStatus}</Text>
        ) : (
          <Box flexDirection="column">
            <Text>Step {configStep + 1} of 3</Text>
            <Box marginTop={1}>
              <Text bold>{currentField}: </Text>
              <TextInput 
                value={configData[currentField]} 
                onChange={(v) => setConfigData(prev => ({ ...prev, [currentField]: v }))} 
                onSubmit={() => {
                  if (configStep < 2) setConfigStep(s => s + 1);
                  else handleSaveConfig();
                }}
              />
            </Box>
            <Box marginTop={1}>
              <Text color="gray">
                {currentField === 'JIRA_DOMAIN' && 'e.g., https://your-company.atlassian.net'}
                {currentField === 'JIRA_EMAIL' && 'Your Atlassian account email'}
                {currentField === 'JIRA_API_TOKEN' && 'Create at id.atlassian.com/manage-profile/security/api-tokens'}
              </Text>
            </Box>
            <Text color="gray" marginTop={1}>Press ENTER to next/save, ESC to cancel</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1} flexGrow={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="blue">🎫 Jira Explorer {view !== 'PROJECTS' && `> ${selectedProjectId}`} {view === 'ISSUES' && `> Board`}</Text>
          {activeSubMenuId && <Text color="magenta">Mode: {activeSubMenuId.toUpperCase()}</Text>}
        </Box>
        <Text color="gray">b: Back | c: Comment | m: Move</Text>
      </Box>

      {view === 'PROJECTS' && (
        <Box flexDirection="column">
          <Text bold underline>Select Project:</Text>
          {projects.map((p, i) => (
            <Text key={p.id} color={i === selectedIndex ? 'cyan' : 'white'}>
              {i === selectedIndex ? '> ' : '  '}{p.key} - {p.name}
            </Text>
          ))}
        </Box>
      )}

      {view === 'BOARDS' && (
        <Box flexDirection="column">
          <Text bold underline>Select Board:</Text>
          {boards.map((b, i) => (
            <Text key={b.id} color={i === selectedIndex ? 'cyan' : 'white'}>
              {i === selectedIndex ? '> ' : '  '}{b.name} ({b.type})
            </Text>
          ))}
        </Box>
      )}

      {view === 'ISSUES' && (
        <Box flexDirection="column">
          <Box flexDirection="row" borderBottomStyle="single" borderColor="gray">
            <Box width={15}><Text bold>Key</Text></Box>
            <Box flexGrow={1}><Text bold>Summary</Text></Box>
            <Box width={15}><Text bold>Status</Text></Box>
          </Box>
          {issues.map((issue, i) => (
            <Box key={issue.id} flexDirection="row">
              <Box width={15}>
                <Text color={i === selectedIndex ? 'cyan' : 'white'} bold={i === selectedIndex}>
                  {i === selectedIndex ? '> ' : '  '}{issue.key}
                </Text>
              </Box>
              <Box flexGrow={1}><Text wrap="truncate-end">{issue.fields.summary}</Text></Box>
              <Box width={15}><Text color="green">{issue.fields.status.name}</Text></Box>
            </Box>
          ))}
        </Box>
      )}

      {view === 'ISSUE_DETAIL' && selectedIssue && (
        <Box flexDirection="column">
          <Box borderStyle="single" borderColor="cyan" paddingX={1}>
            <Text bold color="cyan">{selectedIssue.key}: {selectedIssue.fields.summary}</Text>
            <Text>Status: <Text color="green">{selectedIssue.fields.status.name}</Text> | Assignee: <Text color="yellow">{selectedIssue.fields.assignee?.displayName || 'Unassigned'}</Text></Text>
          </Box>
          
          <Box marginTop={1} paddingX={1}>
            <Text italic color="gray">{selectedIssue.fields.description?.content?.[0]?.content?.[0]?.text || 'No description.'}</Text>
          </Box>

          <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
            <Text bold underline>Comments ({comments.length}):</Text>
            {comments.slice(-5).map((c: any) => (
              <Box key={c.id} flexDirection="column" marginTop={1}>
                <Text bold color="magenta">{c.author.displayName}:</Text>
                <Text>{c.body.content?.[0]?.content?.[0]?.text || '...'}</Text>
              </Box>
            ))}
          </Box>

          {isAddingComment && (
            <Box borderStyle="single" borderColor="yellow" paddingX={1} marginTop={1} flexDirection="column">
              <Text bold>Add Comment:</Text>
              <TextInput value={newComment} onChange={setNewComment} onSubmit={handlePostComment} />
              <Text color="gray">Press ENTER to post, ESC to cancel</Text>
            </Box>
          )}
        </Box>
      )}

      {view === 'TRANSITION' && (
        <Box flexDirection="column">
          <Text bold underline color="yellow">Select New Status:</Text>
          {transitions.map((t, i) => (
            <Text key={t.id} color={i === selectedIndex ? 'yellow' : 'white'}>
              {i === selectedIndex ? '> ' : '  '}{t.name}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};
