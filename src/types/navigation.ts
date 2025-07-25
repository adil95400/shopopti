// 📁 src/types/navigation.ts

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface LinkItem {
  path: string;
  label: string;
  icon: LucideIcon | ReactNode;
}

export interface SidebarSectionType {
  title: string;
  links: LinkItem[];
}
