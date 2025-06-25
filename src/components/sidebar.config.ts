export const sidebarItems = [
  {
    label: "Tableau de bord",
    icon: "layout-dashboard",
    href: "/dashboard",
  },
  {
    label: "Produits",
    icon: "box",
    items: [
      { label: "Produits d'importation", href: "/products/import" },
      { label: "Produits gagnants", href: "/products/winners" },
      { label: "Modèles", href: "/products/templates" },
    ],
  },
  {
    label: "Commandes",
    icon: "shopping-cart",
    items: [
      { label: "Commandes", href: "/orders" },
      { label: "Factures PDF", href: "/orders/invoices" },
      { label: "Retours", href: "/orders/returns" },
    ],
  },
  {
    label: "Clients",
    icon: "users",
    items: [
      { label: "Clients", href: "/clients" },
      { label: "Assistance par chat", href: "/clients/chat" },
    ],
  },
  {
    label: "IA & Optimisations",
    icon: "brain",
    items: [
      { label: "Blog IA", href: "/ai/blog" },
      { label: "SEO IA", href: "/ai/seo" },
      { label: "Audit SEO", href: "/ai/audit" },
      { label: "Centre IA", href: "/ai/center" },
      { label: "SEO Optimizations", href: "/ai/seo-optimizations" },
    ],
  },
  {
    label: "Marketplaces",
    icon: "globe",
    items: [
      { label: "Dropshipping", href: "/marketplaces/dropshipping" },
      { label: "Fournisseurs", href: "/marketplaces/suppliers" },
      { label: "Canaux multiples", href: "/marketplaces/multichannel" },
      { label: "Place de marché B2B", href: "/marketplaces/b2b" },
    ],
  },
  {
    label: "Marketing & Automatisations",
    icon: "zap",
    items: [
      { label: "Centre de marketing", href: "/marketing/center" },
      { label: "Automatisations", href: "/marketing/automation" },
      { label: "Entonnoirs", href: "/marketing/funnels" },
      { label: "Tests A/B", href: "/marketing/ab-tests" },
    ],
  },
  {
    label: "Intégrations",
    icon: "plug",
    items: [
      { label: "Intégrations", href: "/integrations" },
      { label: "Webhooks", href: "/integrations/webhooks" },
    ],
  },
  {
    label: "Paramètres",
    icon: "settings",
    items: [
      { label: "Utilisateurs", href: "/settings/users" },
      { label: "Rôles & Permissions", href: "/settings/roles" },
    ],
  },
  {
    label: "Analyse & Admin",
    icon: "bar-chart",
    items: [
      { label: "Analyse avancée", href: "/admin/analytics" },
      { label: "Admin dashboard", href: "/admin/dashboard" },
    ],
  },
  {
    label: "Support & Abonnement",
    icon: "life-buoy",
    items: [
      { label: "Contact", href: "/support/contact" },
      { label: "Abonnement", href: "/support/pricing" },
    ],
  },
];
