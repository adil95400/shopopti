import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateFAQ } from "@/lib/assistant"; // ✅ Correct si le fichier est dans src/lib/assistant.ts


export const FaqGenerator = () => {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFAQ = async () => {
    setLoading(true);
    const res = await generateFAQ(input);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Décris ton produit pour générer une FAQ personnalisée"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button onClick={handleFAQ} disabled={loading}>
        {loading ? "Génération..." : "Générer FAQ IA"}
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
