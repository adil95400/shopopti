// src/components/layout/sidebar/SidebarSection.tsx

import { NavLink } from "react-router-dom";
import type { SidebarSectionType } from "@/types/navigation";

interface SidebarSectionProps {
  section: SidebarSectionType;
}

export const SidebarSection = ({ section }: SidebarSectionProps) => {
  return (
    <div className="mb-4">
      <h4 className="text-xs font-semibold text-muted-foreground px-4 mb-1 uppercase tracking-wider">
        {section.title}
      </h4>
      <ul className="space-y-1">
        {section.links.map((link) => {
          const Icon = link.icon;
          return (
            <li key={link.path}>
              <NavLink
                to={link.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 text-sm rounded-md transition-colors hover:bg-accent hover:text-accent-foreground ${
                    isActive ? "bg-accent text-primary font-semibold" : "text-muted-foreground"
                  }`
                }
              >
                <Icon className="w-4 h-4 mr-2" />
                {link.label}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
