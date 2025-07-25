import { useState } from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sparkles,
  Bot,
  FileText,
  Globe,
  Star,
  Mail,
  HelpCircle, // ✅ Ajouté ici
} from "lucide-react";

import { ProductFormAI } from "@/components/ai/ProductFormAI";
import { SeoTool } from "@/components/ai/SeoTool";
import { TranslationTool } from "@/components/ai/TranslationTool";
import { FaqGenerator } from "@/components/ai/FaqGenerator";
import { ReviewHelper } from "@/components/ai/ReviewHelper";
import { NewsletterWizard } from "@/components/ai/NewsletterWizard";

export const AssistantAIPage = () => {
  const [tab, setTab] = useState("product");

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-3">
        <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        Assistant IA Shopopti
      </h1>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="flex flex-wrap gap-2 mb-4">
          <TabsTrigger value="product">
            <Bot className="w-4 h-4 mr-1" /> Fiche produit
          </TabsTrigger>
          <TabsTrigger value="seo">
            <FileText className="w-4 h-4 mr-1" /> SEO
          </TabsTrigger>
          <TabsTrigger value="translate">
            <Globe className="w-4 h-4 mr-1" /> Traduction
          </TabsTrigger>
          <TabsTrigger value="faq">
            <HelpCircle className="w-4 h-4 mr-1" /> FAQ
          </TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="w-4 h-4 mr-1" /> Avis
          </TabsTrigger>
          <TabsTrigger value="newsletter">
            <Mail className="w-4 h-4 mr-1" /> Newsletter
          </TabsTrigger>
        </TabsList>

        <TabsContent value="product">
          <ProductFormAI />
        </TabsContent>
        <TabsContent value="seo">
          <SeoTool />
        </TabsContent>
        <TabsContent value="translate">
          <TranslationTool />
        </TabsContent>
        <TabsContent value="faq">
          <FaqGenerator />
        </TabsContent>
        <TabsContent value="reviews">
          <ReviewHelper />
        </TabsContent>
        <TabsContent value="newsletter">
          <NewsletterWizard />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AssistantAIPage;
