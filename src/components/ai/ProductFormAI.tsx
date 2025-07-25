import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateProductSheet } from "@/lib/assistant";

export const ProductFormAI = () => {
  const [productName, setProductName] = useState("");
  const [keywords, setKeywords] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const res = await generateProductSheet({ name: productName, keywords });
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Nom du produit"
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
      />
      <Input
        placeholder="Mots-clés (ex: sport, hiver, chaud)"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
      />
      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? "Génération..." : "Générer fiche IA"}
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
