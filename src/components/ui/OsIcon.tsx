/**
 * KubekOS Dynamic Icon Renderer
 * Maps manifest icon identifiers to Lucide React icons cleanly and safely.
 */

import React from 'react';
import {
  Activity,
  AppWindow,
  Calculator,
  Calendar,
  Code2,
  Compass,
  Cpu,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Info,
  Layers,
  Music,
  Package,
  Settings,
  Shield,
  Sparkles,
  StickyNote,
  Terminal,
  Trash2,
  type LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  folder: Folder,
  'folder-open': FolderOpen,
  terminal: Terminal,
  code: Code2,
  'file-code': FileCode,
  settings: Settings,
  calculator: Calculator,
  notes: StickyNote,
  'file-text': FileText,
  browser: Globe,
  globe: Globe,
  compass: Compass,
  music: Music,
  calendar: Calendar,
  activity: Activity,
  cpu: Cpu,
  image: ImageIcon,
  layers: Layers,
  store: Package,
  info: Info,
  trash: Trash2,
  drive: HardDrive,
  shield: Shield,
  sparkles: Sparkles,
  window: AppWindow,
};

export interface OsIconProps extends LucideProps {
  name: string;
}

export const OsIcon: React.FC<OsIconProps> = ({ name, className = 'w-5 h-5', ...rest }) => {
  const IconComponent = ICON_MAP[name.toLowerCase()] ?? AppWindow;
  return <IconComponent className={className} {...rest} />;
};
