import {
  CalendarDays,
  LayoutDashboard,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Settings2,
  Sparkles,
  LibraryBig,
  FolderOpen,
  FileCheck2,
} from 'lucide-react';
export const NAVIGATION = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'schedule', label: 'Thời khóa biểu', icon: CalendarDays },
  { id: 'work', label: 'Công việc', icon: BriefcaseBusiness },
  { id: 'statistics', label: 'Thống kê', icon: ChartNoAxesCombined },
  { id: 'documents', label: 'Kho đề & tài liệu', icon: FolderOpen },
  { id: 'question-bank', label: 'Ngân hàng câu hỏi', icon: LibraryBig },
  { id: 'classification', label: 'AI phân loại', icon: Sparkles },
  { id: 'exam-builder', label: 'Tạo đề', icon: FileCheck2 },
  { id: 'ai-tools', label: 'AI Tools', icon: Sparkles },
  { id: 'settings', label: 'Cài đặt', icon: Settings2 },
];
