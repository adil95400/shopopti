import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { translateText } from "@/lib/assistant";

export const TranslationTool = () => {
  const [input, setInput] = useState("");
  const [lang, setLang] = useState("en");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    setLoading(true);
    const res = await translateText(input, lang);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Texte à traduire"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <input
        className="border rounded p-2"
        placeholder="Langue cible (ex: en, de, es)"
        value={lang}
        onChange={(e) => setLang(e.target.value)}
      />
      <Button onClick={handleTranslate} disabled={loading}>
        {loading ? "Traduction..." : "Traduire"}
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
