import { ReactNode } from 'react';

export interface ToolPlugin {
  id: string;
  name: string;
  category: 'Network' | 'System' | 'File' | 'Git' | 'Custom';
  icon?: string;
  description: string;
  component: React.ComponentType;
}

export interface AppState {
  activeToolId: string | null;
  tools: ToolPlugin[];
}
