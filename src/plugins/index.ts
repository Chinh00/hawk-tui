import { ToolPlugin } from './types.js';
import { Dashboard } from './Dashboard.jsx';
import { GitStatus } from './GitStatus.jsx';
import { NetworkExplorer } from './NetworkExplorer.jsx';

export const plugins: ToolPlugin[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    category: 'System',
    description: 'System Control Center (CPU, Mem, Net)',
    component: Dashboard,
  },
  {
    id: 'network-explorer',
    name: 'Net Explorer',
    category: 'Network',
    description: 'Searchable connection list',
    component: NetworkExplorer,
  },
  {
    id: 'git-status',
    name: 'Git Status',
    category: 'Git',
    description: 'Current git repository status',
    component: GitStatus,
  }
];
