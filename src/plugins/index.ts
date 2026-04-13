import { ToolPlugin } from './types.js';
import { Dashboard } from './Dashboard.jsx';
import { NetworkExplorer } from './NetworkExplorer.jsx';
import { JiraExplorer } from './JiraExplorer.jsx';
import { GitManager } from './GitManager.jsx';
import { MusicPlayer } from './MusicPlayer.jsx';

export const plugins: ToolPlugin[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    category: 'System',
    description: 'System Control Center (CPU, Mem, Net)',
    component: Dashboard,
    subMenus: [
      { id: 'overview', name: 'Overview' },
      { id: 'processes', name: 'Processes' },
      { id: 'network', name: 'Network' }
    ]
  },
  {
    id: 'network-explorer',
    name: 'Net Explorer',
    category: 'Network',
    description: 'Searchable connection list',
    component: NetworkExplorer,
    subMenus: [
      { id: 'all', name: 'All Conns' },
      { id: 'established', name: 'Established' },
      { id: 'listening', name: 'Listening' }
    ]
  },
  {
    id: 'jira-explorer',
    name: 'Jira Explorer',
    category: 'Management',
    description: 'Jira Cloud Board & Issues',
    component: JiraExplorer,
    subMenus: [
      { id: 'board', name: 'Board' },
      { id: 'issues', name: 'All Issues' },
      { id: 'config', name: 'Configuration' }
    ]
  },
  {
    id: 'git-manager',
    name: 'Git Manager',
    category: 'Git',
    description: 'GitHub/GitLab Repositories',
    component: GitManager,
    subMenus: [
      { id: 'repos', name: 'My Repos' },
      { id: 'config', name: 'Configuration' }
    ]
  },
  {
    id: 'music-player',
    name: 'My Music',
    category: 'Custom',
    description: 'YouTube Music Explorer',
    component: MusicPlayer
  }
];
