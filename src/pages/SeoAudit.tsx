import SeoAuditForm from "../components/SeoAuditForm";
import SeoStatsWidgets from "../components/seo/SeoStatsWidgets";

const mockStats = {
  audits: 125,
  averageScore: 82,
  keywords: 3560
};

export default function SeoAuditPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Audit SEO IA</h1>
      <SeoStatsWidgets stats={mockStats} />
      <SeoAuditForm />
    </div>
  );
}