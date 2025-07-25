import React from "react";
import { X } from "lucide-react";
import { SidebarSection } from "./SidebarSection";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  sections: {
    title: string;
    links: { path: string; label: string; icon: React.ReactNode }[];
  }[];
}

export const SidebarMobileDrawer = ({ open, onClose, sections }: DrawerProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div
        className="bg-white w-64 h-full p-4 overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Shopopti</h2>
          <button onClick={onClose} aria-label="Fermer le menu">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4">
          {sections.map((section) => (
            <SidebarSection key={section.title} section={section} />
          ))}
        </div>
      </div>
    </div>
  );
};
