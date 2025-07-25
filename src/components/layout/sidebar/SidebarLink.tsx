import React from "react";
import { NavLink } from "react-router-dom";

export const SidebarLink = ({ path, label, icon }: { path: string; label: string; icon: React.ReactNode }) => {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded hover:bg-primary/10 transition-colors duration-150 ${
          isActive ? "bg-primary/20 font-semibold" : "text-muted-foreground"
        }`
      }
    >
      {icon} <span className="text-sm">{label}</span>
    </NavLink>
  );
};
