import {
  CalendarDays,
  LayoutDashboard,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Settings2,
  Sparkles,
  LibraryBig,
  FolderOpen,
} from 'lucide-react';
export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schedule', label: 'Thời khóa biểu', icon: CalendarDays },
  { id: 'work', label: 'Công việc', icon: BriefcaseBusiness },
  { id: 'statistics', label: 'Thống kê', icon: ChartNoAxesCombined },
  { id: 'documents', label: 'Kho đề & tài liệu', icon: FolderOpen },
  { id: 'question-bank', label: 'Ngân hàng câu hỏi', icon: LibraryBig },
  { id: 'ai-tools', label: 'AI Tools', icon: Sparkles },
  { id: 'settings', label: 'Cài đặt', icon: Settings2 },
];
