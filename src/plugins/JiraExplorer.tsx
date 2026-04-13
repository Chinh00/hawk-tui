import React, { useState, useEffect } from 'react';
import { Text, Box, Newline, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { jiraService } from '../services/jira.js';
import { updateEnv } from '../utils/env.js';
import { ToolPluginProps } from './types.js';

type ViewState = 'PROJECTS' | 'BOARDS' | 'ISSUES' | 'ISSUE_DETAIL' | 'TRANSITION' | 'CONFIG' | 'FILTER_EPIC' | 'FILTER_TYPE' | 'FILTER_USER';

const PAGE_SIZE = 15;

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
  const [epics, setEpics] = useState<any[]>([]);
  const [issueTypes, setIssueTypes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [transitions, setTransitions] = useState<any[]>([]);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProjectId, setSelectedProject] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoard] = useState<number | null>(null);
  
  // Filters
  const [filterEpic, setFilterEpic] = useState({ key: 'ALL', name: 'All Epics' });
  const [filterType, setFilterType] = useState({ name: 'ALL' });
  const [filterUser, setFilterUser] = useState({ id: 'ALL', name: 'All Users' });
  
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

    if (view === 'CONFIG') {
      loadProjects();
    }
  }, [activeSubMenuId]);

  useEffect(() => {
    if (jiraService.isConfigured && view === 'PROJECTS' && projects.length === 0) {
      loadProjects();
    }
  }, []);

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

  const loadFilterData = async (boardId: number, projectKey: string) => {
    setLoading(true);
    try {
      const [epicsData, typesData, usersData] = await Promise.all([
        jiraService.getEpics(boardId).catch(() => []),
        jiraService.getIssueTypes(),
        jiraService.getUsers(projectKey)
      ]);
      setEpics([{ key: 'ALL', name: '--- All Epics ---' }, ...epicsData]);
      setIssueTypes([{ name: 'ALL' }, ...typesData]);
      setUsers([{ accountId: 'ALL', displayName: '--- All Users ---' }, ...usersData]);
      
      // Default issues load
      await loadIssues(boardId, 'ALL', 'ALL', 'ALL');
    } catch (err: any) {
      setError(`Failed to load board metadata: ${err.message}`);
      setLoading(false);
    }
  };

  const loadIssues = async (boardId: number, epicKey: string, typeName: string, userId: string) => {
    setLoading(true);
    try {
      const data = await jiraService.getIssues(boardId, {
        epicKey: epicKey === 'ALL' ? undefined : epicKey,
        typeName: typeName === 'ALL' ? undefined : typeName,
        assigneeId: userId === 'ALL' ? undefined : userId
      });
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
      if (isAddingComment && key.escape) setIsAddingComment(false);
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
      view === 'FILTER_EPIC' ? epics :
      view === 'FILTER_TYPE' ? issueTypes :
      view === 'FILTER_USER' ? users :
      view === 'TRANSITION' ? transitions : [];

    if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
    if (key.downArrow) setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));
    
    if (key.return) {
      if (view === 'PROJECTS' && projects.length > 0) {
        const p = projects[selectedIndex];
        setSelectedProject(p.key);
        loadBoards(p.key);
      } else if (view === 'BOARDS' && boards.length > 0) {
        const b = boards[selectedIndex];
        setSelectedBoard(b.id);
        loadFilterData(b.id, selectedProjectId!);
      } else if (view === 'ISSUES' && issues.length > 0) {
        loadIssueDetail(issues[selectedIndex].key);
      } else if (view === 'FILTER_EPIC') {
        const e = epics[selectedIndex];
        setFilterEpic({ key: e.key, name: e.name || e.key });
        loadIssues(selectedBoardId!, e.key, filterType.name, filterUser.id);
      } else if (view === 'FILTER_TYPE') {
        const t = issueTypes[selectedIndex];
        setFilterType({ name: t.name });
        loadIssues(selectedBoardId!, filterEpic.key, t.name, filterUser.id);
      } else if (view === 'FILTER_USER') {
        const u = users[selectedIndex];
        setFilterUser({ id: u.accountId, name: u.displayName });
        loadIssues(selectedBoardId!, filterEpic.key, filterType.name, u.accountId);
      } else if (view === 'TRANSITION') {
        handleTransition(transitions[selectedIndex].id);
      }
    }

    if (input === 'b' || key.escape) {
      if (view === 'BOARDS') loadProjects();
      else if (view === 'ISSUES') loadBoards(selectedProjectId!);
      else if (view.startsWith('FILTER_')) setView('ISSUES');
      else if (view === 'ISSUE_DETAIL' || view === 'TRANSITION') setView('ISSUES');
    }

    if (view === 'ISSUES') {
      if (input === 'e') { setView('FILTER_EPIC'); setSelectedIndex(0); }
      if (input === 't') { setView('FILTER_TYPE'); setSelectedIndex(0); }
      if (input === 'u') { setView('FILTER_USER'); setSelectedIndex(0); }
    }

    if (view === 'ISSUE_DETAIL') {
      if (input === 'c') setIsAddingComment(true);
      if (input === 'm') { setView('TRANSITION'); setSelectedIndex(0); }
    }
  });

  const getScrollWindow = (items: any[]) => {
    let start = Math.max(0, selectedIndex - Math.floor(PAGE_SIZE / 2));
    let end = start + PAGE_SIZE;
    if (end > items.length) {
      end = items.length;
      start = Math.max(0, end - PAGE_SIZE);
    }
    return { visibleItems: items.slice(start, end), startIndex: start, total: items.length };
  };

  const renderScrollInfo = (current: number, total: number) => {
    if (total <= PAGE_SIZE) return null;
    return (
      <Box marginTop={1} borderStyle="classic" borderColor="gray" paddingX={1}>
        <Text color="gray">Scrolling: {current + 1} / {total}</Text>
      </Box>
    );
  };

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
        {configStatus ? <Text color="green">{configStatus}</Text> : (
          <Box flexDirection="column">
            <Text>Step {configStep + 1} of 3</Text>
            <Box marginTop={1}>
              <Text bold>{currentField}: </Text>
              <TextInput value={configData[currentField]} onChange={(v) => setConfigData(prev => ({ ...prev, [currentField]: v }))} onSubmit={() => { if (configStep < 2) setConfigStep(s => s + 1); else handleSaveConfig(); }} />
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
          <Box>
            <Text bold color="blue">🎫 Jira Explorer</Text>
            {selectedProjectId && <Text color="blue">{` > ${selectedProjectId}`}</Text>}
            {selectedBoardId && <Text color="blue">{` > Board`}</Text>}
          </Box>
          <Box marginTop={1}>
            <Text color="gray">Keys: </Text>
            <Text color="cyan">e: Epic </Text>
            <Text color="yellow">t: Type </Text>
            <Text color="green">u: User </Text>
            <Text color="gray">| b: Back</Text>
          </Box>
        </Box>
      </Box>

      {view === 'PROJECTS' && (
        <Box flexDirection="column">
          <Text bold underline>Select Project ({projects.length}):</Text>
          {getScrollWindow(projects).visibleItems.map((p, i) => {
            const actualIndex = i + getScrollWindow(projects).startIndex;
            return <Text key={p.id} color={actualIndex === selectedIndex ? 'cyan' : 'white'}>{actualIndex === selectedIndex ? '> ' : '  '}{p.key} - {p.name}</Text>;
          })}
          {renderScrollInfo(selectedIndex, projects.length)}
        </Box>
      )}

      {view === 'BOARDS' && (
        <Box flexDirection="column">
          <Text bold underline>Select Board ({boards.length}):</Text>
          {getScrollWindow(boards).visibleItems.map((b, i) => {
            const actualIndex = i + getScrollWindow(boards).startIndex;
            return <Text key={b.id} color={actualIndex === selectedIndex ? 'cyan' : 'white'}>{actualIndex === selectedIndex ? '> ' : '  '}{b.name} ({b.type})</Text>;
          })}
          {renderScrollInfo(selectedIndex, boards.length)}
        </Box>
      )}

      {(view === 'ISSUES' || view.startsWith('FILTER_')) && (
        <Box flexDirection="column">
          {/* Filter Bar */}
          <Box borderStyle="single" borderColor="gray" paddingX={1} marginBottom={1} justifyContent="space-around">
            <Box><Text color={view === 'FILTER_EPIC' ? 'cyan' : 'white'} bold={view === 'FILTER_EPIC'}>[E] Epic: </Text><Text color="cyan">{filterEpic.name}</Text></Box>
            <Box><Text color={view === 'FILTER_TYPE' ? 'yellow' : 'white'} bold={view === 'FILTER_TYPE'}>[T] Type: </Text><Text color="yellow">{filterType.name}</Text></Box>
            <Box><Text color={view === 'FILTER_USER' ? 'green' : 'white'} bold={view === 'FILTER_USER'}>[U] User: </Text><Text color="green">{filterUser.name}</Text></Box>
          </Box>

          {view === 'ISSUES' ? (
            <Box flexDirection="column">
              <Box flexDirection="row" borderBottomStyle="single" borderColor="gray">
                <Box width={12}><Text bold>Key</Text></Box>
                <Box width={10}><Text bold>Type</Text></Box>
                <Box width={12}><Text bold>Epic</Text></Box>
                <Box flexGrow={1}><Text bold>Summary</Text></Box>
                <Box width={12}><Text bold>Status</Text></Box>
              </Box>
              {getScrollWindow(issues).visibleItems.map((issue, i) => {
                const actualIndex = i + getScrollWindow(issues).startIndex;
                return (
                  <Box key={issue.id} flexDirection="row">
                    <Box width={12}><Text color={actualIndex === selectedIndex ? 'cyan' : 'white'} bold={actualIndex === selectedIndex}>{actualIndex === selectedIndex ? '> ' : '  '}{issue.key}</Text></Box>
                    <Box width={10}><Text color="yellow" wrap="truncate-end">{issue.fields.issuetype.name}</Text></Box>
                    <Box width={12}><Text color="magenta" wrap="truncate-end">{issue.fields.epic?.name || issue.fields.epic?.key || ''}</Text></Box>
                    <Box flexGrow={1}><Text wrap="truncate-end">{issue.fields.summary}</Text></Box>
                    <Box width={12}><Text color="green" wrap="truncate-end">{issue.fields.status.name}</Text></Box>
                  </Box>
                );
              })}
              {renderScrollInfo(selectedIndex, issues.length)}
            </Box>
          ) : (
            <Box flexDirection="column" borderStyle="double" borderColor="white" paddingX={1}>
              <Text bold underline>{view === 'FILTER_EPIC' ? 'Select Epic:' : view === 'FILTER_TYPE' ? 'Select Type:' : 'Select User:'}</Text>
              {getScrollWindow(view === 'FILTER_EPIC' ? epics : view === 'FILTER_TYPE' ? issueTypes : users).visibleItems.map((item, i) => {
                const actualIndex = i + getScrollWindow(view === 'FILTER_EPIC' ? epics : view === 'FILTER_TYPE' ? issueTypes : users).startIndex;
                const label = view === 'FILTER_EPIC' ? (item.name || item.key) : view === 'FILTER_TYPE' ? item.name : item.displayName;
                return <Text key={item.id || item.accountId || item.name} color={actualIndex === selectedIndex ? 'white' : 'gray'}>{actualIndex === selectedIndex ? '> ' : '  '}{label}</Text>;
              })}
            </Box>
          )}
        </Box>
      )}

      {view === 'ISSUE_DETAIL' && selectedIssue && (
        <Box flexDirection="column">
          <Box borderStyle="single" borderColor="cyan" paddingX={1} flexDirection="column">
            <Text bold color="cyan">{selectedIssue.key}: {selectedIssue.fields.summary}</Text>
            <Box>
              <Text>Type: </Text><Text color="yellow">{selectedIssue.fields.issuetype.name}</Text>
              <Text> | Status: </Text><Text color="green">{selectedIssue.fields.status.name}</Text>
              <Text> | Epic: </Text><Text color="magenta">{selectedIssue.fields.epic?.name || 'None'}</Text>
            </Box>
            <Box>
              <Text>Start: </Text><Text color="blue">{new Date(selectedIssue.fields.created).toLocaleString()}</Text>
              <Text> | End (Due): </Text><Text color="red">{selectedIssue.fields.duedate ? new Date(selectedIssue.fields.duedate).toLocaleDateString() : 'No Due Date'}</Text>
            </Box>
            <Text>Assignee: <Text color="yellow">{selectedIssue.fields.assignee?.displayName || 'Unassigned'}</Text></Text>
          </Box>
          <Box marginTop={1} paddingX={1} maxHeight={5}><Text italic color="gray">{selectedIssue.fields.description?.content?.[0]?.content?.[0]?.text || 'No description.'}</Text></Box>
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
          {getScrollWindow(transitions).visibleItems.map((t, i) => {
            const actualIndex = i + getScrollWindow(transitions).startIndex;
            return <Text key={t.id} color={actualIndex === selectedIndex ? 'yellow' : 'white'}>{actualIndex === selectedIndex ? '> ' : '  '}{t.name}</Text>;
          })}
          {renderScrollInfo(selectedIndex, transitions.length)}
        </Box>
      )}
    </Box>
  );
};
