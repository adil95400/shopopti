import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { optimizeSeo } from "@/lib/assistant";

export const SeoTool = () => {
  const [description, setDescription] = useState("");
  const [lang, setLang] = useState("fr");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSeo = async () => {
    setLoading(true);
    const res = await optimizeSeo({ description, lang });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Description produit ou texte à optimiser"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <Input
        placeholder="Langue (fr, en, es...)"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
      />
      <Button onClick={handleSeo} disabled={loading}>
        {loading ? "Optimisation..." : "Optimiser SEO"}
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
