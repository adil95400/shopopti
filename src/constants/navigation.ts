// src/constants/navigation.ts

import {
  LayoutDashboard, Sparkles, ShoppingBag, Import, Package, Truck,
  Bot, Search, Zap, Building, Globe, Star, Megaphone, GitBranch,
  Mail, FileText, DollarSign, MessageSquare, RefreshCw, FileCode,
  Settings, CreditCard, Code, Webhook, BarChart3
} from 'lucide-react';

import type { SidebarSectionType } from "@/types/navigation";


export const sidebarSections: SidebarSectionType[] = [
  {
    title: '📊 Dashboard & Assistant',
    links: [
      { path: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/assistant', label: 'Assistant IA', icon: Sparkles },
    ]
  },
  {
    title: '📦 Produits & Commandes',
    links: [
      { path: '/app/products', label: 'Produits', icon: ShoppingBag },
      { path: '/app/import-products', label: 'Importation', icon: Import },
      { path: '/app/inventory', label: 'Stock & Alertes', icon: Package },
      { path: '/app/orders', label: 'Commandes', icon: Truck },
      { path: '/tracking', label: 'Suivi colis', icon: Truck },
    ]
  },
  {
    title: '💡 IA & Automations',
    links: [
      { path: '/blog-ai', label: 'Blog IA', icon: Bot },
      { path: '/seo-ai', label: 'SEO IA', icon: Sparkles },
      { path: '/app/seo-audit', label: 'Audit SEO', icon: Search },
      { path: '/app/ai-hub', label: 'AI Hub', icon: Bot },
      { path: '/app/automations', label: 'Automations', icon: Zap },
    ]
  },
  {
    title: '🛍️ Marketplace & Fournisseurs',
    links: [
      { path: '/app/suppliers', label: 'Fournisseurs', icon: Building },
      { path: '/marketplace-b2b', label: 'Marketplace B2B', icon: Globe },
      { path: '/app/winning-products', label: 'Produits gagnants', icon: Star },
      { path: '/app/global-marketplaces', label: 'Marchés mondiaux', icon: Globe },
    ]
  },
  {
    title: '📈 Marketing & Contenu',
    links: [
      { path: '/app/marketing-hub', label: 'Marketing Hub', icon: Megaphone },
      { path: '/app/funnels', label: 'Tunnels de vente', icon: GitBranch },
      { path: '/app/newsletters', label: 'Newsletter IA', icon: Mail },
      { path: '/app/reviews', label: 'Avis clients', icon: Star },
      { path: '/generate-invoice', label: 'Factures PDF', icon: FileText },
    ]
  },
  {
    title: '🧠 Modules avancés',
    links: [
      { path: '/app/repricing', label: 'Repricing', icon: DollarSign },
      { path: '/app/chat-support', label: 'Chat Support', icon: MessageSquare },
      { path: '/app/returns', label: 'Retours', icon: RefreshCw },
      { path: '/app/templates', label: 'Templates', icon: FileCode },
    ]
  },
  {
    title: '⚙️ Paramètres & Intégrations',
    links: [
      { path: '/app/settings', label: 'Paramètres', icon: Settings },
      { path: '/app/accounting', label: 'Comptabilité', icon: FileText },
      { path: '/app/subscription', label: 'Abonnement', icon: CreditCard },
      { path: '/app/integrations', label: 'Intégrations', icon: Code },
      { path: '/app/webhooks', label: 'Webhooks', icon: Webhook },
      { path: '/app/contact', label: 'Contact', icon: Mail },
    ]
  },
  {
    title: '🔐 Admin',
    links: [
      { path: '/app/admin/dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
      { path: '/app/admin/users', label: 'Utilisateurs', icon: Building },
      { path: '/app/admin/imports', label: 'Imports', icon: Import },
      { path: '/app/admin/analytics', label: 'Analytics Admin', icon: BarChart3 },
    ]
  }
];
