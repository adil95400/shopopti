import React, { useState } from 'react';
import { sidebarSections } from '@/constants/navigation'; // à créer
import Logo from '../Logo';
import { SidebarSection } from './SidebarSection';
import { SidebarMobileDrawer } from './SidebarMobileDrawer';

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Topbar mobile */}
      <div className="md:hidden flex items-center justify-between p-4 border-b sticky top-0 bg-muted z-40">
        <Logo />
        <button onClick={() => setOpen(true)}><span className="sr-only">Menu</span>☰</button>
      </div>

      {/* Drawer mobile */}
      <SidebarMobileDrawer open={open} onClose={() => setOpen(false)} sections={sidebarSections} />

      {/* Sidebar desktop */}
      <aside className="w-64 hidden md:block bg-muted p-4 border-r min-h-screen overflow-y-auto">
        <div className="mb-6">
          <Logo />
        </div>
        <div className="space-y-4">
          {sidebarSections.map((section) => (
            <SidebarSection key={section.title} section={section} />
          ))}
        </div>
      </aside>
    </>
  );
}
