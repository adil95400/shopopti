import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { synthesizeReviews } from "@/lib/assistant";

export const ReviewHelper = () => {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReview = async () => {
    setLoading(true);
    const rawReviews = input.split("\n").filter((r) => r.trim() !== "");
    const res = await synthesizeReviews(rawReviews);
    setResult(res);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Colle ici plusieurs avis clients (1 par ligne)"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button onClick={handleReview} disabled={loading}>
        {loading ? "Analyse..." : "Synthétiser les avis IA"}
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
