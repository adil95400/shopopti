import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createNewsletter } from "@/lib/assistant";

export const NewsletterWizard = () => {
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const res = await createNewsletter({ subject, audience });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Sujet de la newsletter"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
      />
      <Input
        placeholder="Public cible (ex: nouveaux clients, abonnés, VIP...)"
        value={audience}
        onChange={(e) => setAudience(e.target.value)}
      />
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? "Génération..." : "Générer newsletter IA"}
      </Button>
      {result && (
        <Textarea
          className="min-h-[200px] mt-4"
          value={result}
          readOnly
        />
      )}
    </div>
  );
};
