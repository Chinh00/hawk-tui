import React, { useState, useEffect } from 'react';
import { Text, Box, Newline, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import { gitService } from '../services/git.js';
import { updateEnv } from '../utils/env.js';
import { formatRelativeTime } from '../utils/date.js';
import { ToolPluginProps } from './types.js';

type ViewState = 'REPOS' | 'REPO_DETAIL' | 'CONFIG' | 'COMMIT_FILES';
type DetailSubView = 'OVERVIEW' | 'BRANCHES' | 'PRS' | 'COMMITS';

interface FileNode {
  name: string;
  path: string;
  isDir: boolean;
  children: Record<string, FileNode>;
  status?: string;
  diff?: string;
}

export const GitManager: React.FC<ToolPluginProps> = ({ activeSubMenuId, isFocused }) => {
  const [view, setView] = useState<ViewState>('REPOS');
  const [subView, setSubView] = useState<DetailSubView>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<any | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [pullRequests, setPullRequests] = useState<any[]>([]);
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<any | null>(null);
  const [flatFiles, setFlatFiles] = useState<any[]>([]);
  const [fileTree, setFileTree] = useState<FileNode | null>(null);
  const [activeBranch, setActiveBranch] = useState<string | undefined>(undefined);
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const [configStep, setConfigStep] = useState(0);
  const [configData, setConfigData] = useState({
    GIT_PLATFORM: process.env.GIT_PLATFORM || 'github',
    GIT_TOKEN: process.env.GIT_TOKEN || '',
    GIT_DOMAIN: process.env.GIT_DOMAIN || ''
  });
  const [configStatus, setConfigStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeSubMenuId === 'config') {
      setView('CONFIG');
      setConfigStep(0);
      setConfigStatus(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (!gitService.isGitConfigured) {
      setError('Git not configured. Use Config menu to set Platform and Token.');
      setLoading(false);
      return;
    }
    loadRepos();
  }, [activeSubMenuId]);

  const loadRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gitService.getRepositories();
      setRepos(data);
      setView('REPOS');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load repositories: ${err.message}`);
      setLoading(false);
    }
  };

  const loadRepoDetail = async (repo: any) => {
    setLoading(true);
    setSelectedRepo(repo);
    setActiveBranch(undefined);
    try {
      const [brs, prs] = await Promise.all([
        gitService.getBranches(repo.fullName || repo.id),
        gitService.getPullRequests(repo.fullName || repo.id)
      ]);
      setBranches(brs);
      setPullRequests(prs);
      setView('REPO_DETAIL');
      setSubView('OVERVIEW');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load repo details: ${err.message}`);
      setLoading(false);
    }
  };

  const loadCommits = async (branch?: string) => {
    setLoading(true);
    setActiveBranch(branch);
    try {
      const data = await gitService.getCommits(selectedRepo.fullName || selectedRepo.id, branch);
      setCommits(data);
      setSubView('COMMITS');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load commits: ${err.message}`);
      setLoading(false);
    }
  };

  const buildFileTree = (files: any[]): FileNode => {
    const root: FileNode = { name: 'root', path: '', isDir: true, children: {} };
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = root;
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: parts.slice(0, index + 1).join('/'),
            isDir: !isLast,
            children: {},
            status: isLast ? file.status : undefined,
            diff: isLast ? file.diff : undefined
          };
        }
        current = current.children[part];
      });
    });
    return root;
  };

  const loadCommitFiles = async (commit: any) => {
    setLoading(true);
    setSelectedCommit(commit);
    try {
      const files = await gitService.getCommitFiles(selectedRepo.fullName || selectedRepo.id, commit.hash);
      setFlatFiles(files);
      setFileTree(buildFileTree(files));
      setView('COMMIT_FILES');
      setSelectedIndex(0);
      setLoading(false);
    } catch (err: any) {
      setError(`Failed to load commit files: ${err.message}`);
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    try {
      updateEnv(configData);
      gitService.reconfigure();
      setConfigStatus('✅ Git configuration saved!');
      setTimeout(() => {
        if (gitService.isGitConfigured) loadRepos();
      }, 1500);
    } catch (err: any) {
      setError(`Failed to save config: ${err.message}`);
    }
  };

  const renderDiff = (diff?: string) => {
    if (!diff) return <Text color="gray">No changes to show.</Text>;
    return (
      <Box flexDirection="column">
        {diff.split('\n').map((line, i) => {
          let color = 'white';
          if (line.startsWith('+')) color = 'green';
          else if (line.startsWith('-')) color = 'red';
          else if (line.startsWith('@@')) color = 'cyan';
          return <Text key={i} color={color}>{line}</Text>;
        })}
      </Box>
    );
  };

  useInput((input, key) => {
    if (!isFocused || loading || error) {
      if (error && key.escape) setError(null);
      return;
    }

    if (view === 'CONFIG') return;

    if (view === 'REPOS') {
      if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
      if (key.downArrow) setSelectedIndex(Math.min(repos.length - 1, selectedIndex + 1));
      if (key.return) loadRepoDetail(repos[selectedIndex]);
    } else if (view === 'REPO_DETAIL') {
      if (key.escape || input === 'b') {
        setView('REPOS');
        setSelectedIndex(repos.findIndex(r => r.id === selectedRepo.id) || 0);
      }
      if (input === '1') setSubView('OVERVIEW');
      if (input === '2') { setSubView('BRANCHES'); setSelectedIndex(0); }
      if (input === '3') { setSubView('PRS'); setSelectedIndex(0); }
      if (input === '4') { loadCommits(); }
      
      const items = subView === 'BRANCHES' ? branches : subView === 'PRS' ? pullRequests : subView === 'COMMITS' ? commits : [];
      if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
      if (key.downArrow) setSelectedIndex(Math.min(items.length - 1, selectedIndex + 1));
      
      if (key.return) {
        if (subView === 'BRANCHES') loadCommits(branches[selectedIndex].name);
        else if (subView === 'COMMITS') loadCommitFiles(commits[selectedIndex]);
      }
    } else if (view === 'COMMIT_FILES') {
      if (key.escape || input === 'b') {
        setView('REPO_DETAIL');
        setSubView('COMMITS');
        setSelectedIndex(commits.findIndex(c => c.hash === selectedCommit.hash) || 0);
      }
      if (key.upArrow) setSelectedIndex(Math.max(0, selectedIndex - 1));
      if (key.downArrow) setSelectedIndex(Math.min(flatFiles.length - 1, selectedIndex + 1));
    }
  });

  if (error) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="red">
        <Text color="red" bold>⚠️ Git Error</Text>
        <Text>{error}</Text>
        <Text color="gray" marginTop={1}>Press ESC to clear</Text>
      </Box>
    );
  }

  if (loading) return <Box padding={1}><Text color="cyan">🚀 Processing Git request...</Text></Box>;

  if (view === 'CONFIG') {
    if (configStep === 0) {
      return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow" flexGrow={1}>
          <Text bold color="yellow">⚙️ Select Git Platform</Text>
          <Box height={1} />
          <SelectInput 
            items={[
              { label: 'GitHub', value: 'github' },
              { label: 'GitLab', value: 'gitlab' }
            ]} 
            onSelect={(item) => {
              setConfigData(prev => ({ ...prev, GIT_PLATFORM: item.value }));
              setConfigStep(1);
            }} 
          />
        </Box>
      );
    }

    const fields = ['GIT_TOKEN', 'GIT_DOMAIN'] as const;
    const currentField = fields[configStep - 1];

    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow" flexGrow={1}>
        <Text bold color="yellow">⚙️ Git Configuration ({configData.GIT_PLATFORM.toUpperCase()})</Text>
        <Box height={1} />
        {configStatus ? <Text color="green">{configStatus}</Text> : (
          <Box flexDirection="column">
            <Text>Step {configStep + 1} of 3</Text>
            <Box marginTop={1}>
              <Text bold>{currentField}: </Text>
              <TextInput 
                value={configData[currentField]} 
                onChange={(v) => setConfigData(prev => ({ ...prev, [currentField]: v }))} 
                onSubmit={() => {
                  if (configStep === 1) setConfigStep(2);
                  else handleSaveConfig();
                }}
              />
            </Box>
            <Box marginTop={1}>
              <Text color="gray">
                {currentField === 'GIT_TOKEN' && 'Enter Personal Access Token'}
                {currentField === 'GIT_DOMAIN' && 'e.g. https://gitlab.mycompany.com (Leave empty for GitLab.com)'}
              </Text>
            </Box>
            <Text color="gray" marginTop={1}>Press ENTER to next/save, ESC to cancel</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="row" flexGrow={1}>
      {(view === 'REPOS' || view === 'REPO_DETAIL' || view === 'COMMIT_FILES') && (
        <Box 
          flexDirection="column" 
          width={view === 'REPOS' ? '100%' : 35} 
          borderRightStyle="single" 
          borderColor="gray" 
          paddingRight={1}
        >
          <Box justifyContent="space-between" marginBottom={1}>
            <Text bold color="cyan">📦 Repositories ({repos.length})</Text>
            {view !== 'REPOS' && <Text color="gray">ESC: Back</Text>}
          </Box>
          
          {repos.map((r, i) => (
            <Box key={r.id} justifyContent="space-between">
              <Text color={r.id === selectedRepo?.id ? 'green' : (i === selectedIndex && view === 'REPOS' ? 'cyan' : 'white')} wrap="truncate-end">
                {i === selectedIndex && view === 'REPOS' ? '> ' : '  '}{r.fullName}
              </Text>
              {view === 'REPOS' && <Text color="gray">{formatRelativeTime(r.updatedAt)}</Text>}
            </Box>
          ))}
        </Box>
      )}

      {view === 'REPO_DETAIL' && selectedRepo && (
        <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
          <Box borderBottomStyle="double" borderColor="green" marginBottom={1} flexDirection="column">
            <Box justifyContent="space-between">
              <Text bold color="green" fontSize="large">{selectedRepo.fullName}</Text>
              <Text color="gray">Updated {formatRelativeTime(selectedRepo.updatedAt)}</Text>
            </Box>
            <Text color="gray">{selectedRepo.description || 'No description'}</Text>
          </Box>

          <Box marginBottom={1}>
            <Text color={subView === 'OVERVIEW' ? 'cyan' : 'white'} bold={subView === 'OVERVIEW'}> [1] Info </Text>
            <Text color={subView === 'BRANCHES' ? 'cyan' : 'white'} bold={subView === 'BRANCHES'}> [2] Branches </Text>
            <Text color={subView === 'PRS' ? 'cyan' : 'white'} bold={subView === 'PRS'}> [3] PRs/MRs </Text>
            <Text color={subView === 'COMMITS' ? 'cyan' : 'white'} bold={subView === 'COMMITS'}> [4] Commits </Text>
          </Box>

          <Box flexGrow={1}>
            {subView === 'OVERVIEW' && (
              <Box flexDirection="column">
                <Text>URL: <Text color="blue">{selectedRepo.url}</Text></Text>
                <Text>Visibility: <Text color="yellow">{selectedRepo.visibility}</Text></Text>
                <Text>Stars: <Text color="yellow">⭐ {selectedRepo.stars}</Text></Text>
                <Text>Owner: <Text color="magenta">{selectedRepo.owner}</Text></Text>
                <Text>Last Activity: <Text color="cyan">{new Date(selectedRepo.updatedAt).toLocaleString()}</Text></Text>
              </Box>
            )}

            {subView === 'BRANCHES' && (
              <Box flexDirection="column">
                {branches.map((b, i) => (
                  <Box key={i} justifyContent="space-between">
                    <Text color={i === selectedIndex ? 'cyan' : 'white'}>
                      {i === selectedIndex ? '● ' : '  '}{b.name}
                    </Text>
                    {b.date && <Text color="gray">{formatRelativeTime(b.date)}</Text>}
                  </Box>
                ))}
              </Box>
            )}

            {subView === 'COMMITS' && (
              <Box flexDirection="column">
                <Text color="yellow" bold marginBottom={1}>History: {activeBranch || 'Default Branch'}</Text>
                {commits.map((c, i) => (
                  <Box key={i} flexDirection="column" marginBottom={1}>
                    <Box justifyContent="space-between">
                      <Text color={i === selectedIndex ? 'yellow' : 'cyan'} bold>{i === selectedIndex ? '> ' : ''}{c.shortHash}</Text>
                      <Text color="gray">{formatRelativeTime(c.date)}</Text>
                    </Box>
                    <Text wrap="truncate-end" bold={i === selectedIndex}>{c.message}</Text>
                    <Text color="magenta" dimColor italic>by {c.author}</Text>
                  </Box>
                ))}
              </Box>
            )}

            {subView === 'PRS' && (
              <Box flexDirection="column">
                <Box flexDirection="row" borderBottomStyle="single" borderColor="gray">
                  <Box width={8}><Text bold>#</Text></Box>
                  <Box flexGrow={1}><Text bold>Title</Text></Box>
                  <Box width={15}><Text bold>Created</Text></Box>
                </Box>
                {pullRequests.map((pr, i) => (
                  <Box key={pr.id} flexDirection="row">
                    <Box width={8}><Text color="gray">{pr.number}</Text></Box>
                    <Box flexGrow={1}><Text color={i === selectedIndex ? 'cyan' : 'white'} wrap="truncate-end">{pr.title}</Text></Box>
                    <Box width={15}><Text color="gray">{formatRelativeTime(pr.createdAt)}</Text></Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      )}

      {view === 'COMMIT_FILES' && selectedCommit && (
        <Box flexDirection="row" flexGrow={1} paddingLeft={2}>
          {/* Cột file thay đổi */}
          <Box flexDirection="column" width={40} borderRightStyle="single" borderColor="gray" paddingRight={1}>
            <Text bold color="yellow">Changed Files ({flatFiles.length})</Text>
            <Box height={1} />
            {flatFiles.map((f, i) => (
              <Box key={i}>
                <Text color={i === selectedIndex ? 'cyan' : 'white'} wrap="truncate-end">
                  {i === selectedIndex ? '> ' : '  '}{f.path}
                </Text>
              </Box>
            ))}
          </Box>

          {/* Cột hiển thị Diff */}
          <Box flexDirection="column" flexGrow={1} paddingLeft={2}>
            <Text bold underline color="cyan">Diff: {flatFiles[selectedIndex]?.path}</Text>
            <Box marginTop={1}>
              {renderDiff(flatFiles[selectedIndex]?.diff)}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};
