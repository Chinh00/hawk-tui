import { ReactNode } from 'react';

export interface SubMenu {
  id: string;
  name: string;
}

export interface ToolPluginProps {
  activeSubMenuId?: string;
  isFocused?: boolean;
}

export interface ToolPlugin {
  id: string;
  name: string;
  category: 'Network' | 'System' | 'File' | 'Git' | 'Custom' | 'Management';
  icon?: string;
  description: string;
  component: React.ComponentType<ToolPluginProps>;
  subMenus?: SubMenu[];
}

export interface AppState {
  activeToolId: string | null;
  tools: ToolPlugin[];
}
