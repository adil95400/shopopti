import axios from 'axios';
import * as cheerio from 'cheerio';
import type { ProductVariant } from '../types/product';

interface ScrapingOptions {
  proxy?: boolean;
  timeout?: number;
  retries?: number;
}


interface ScrapedProduct {
  title: string;
  description: string;
  price: number | string;
  images: string[];
  variants?: ProductVariant[];
  metadata: Record<string, any>;
}

export const scrapingService = {
  async scrapeShopify(url: string, options: ScrapingOptions = {}): Promise<ScrapedProduct> {
    try {
      const shopifyUrlPattern = /^https?:\/\/(?:.*?)\.myshopify\.com|shopify\.com/i;
      if (!shopifyUrlPattern.test(url)) {
        throw new Error('URL invalide. Veuillez fournir une URL Shopify valide.');
      }

      const handle = url.split('/products/').pop()?.split('?')[0];
      if (!handle) throw new Error('URL de produit invalide');

      const jsonUrl = `${url.split('?')[0]}.json`;
      const { data } = await axios.get(jsonUrl, {
        timeout: options.timeout || 15000
      });

      if (!data.product) {
        throw new Error('Produit non trouvé');
      }

      return {
        title: data.product.title,
        description: data.product.body_html,
        price: parseFloat(data.product.variants[0].price),
        images: data.product.images.map((img: { src: string }) => img.src),
        variants: data.product.variants.map((variant: any) => ({
          title: variant.title,
          price: parseFloat(variant.price),
          sku: variant.sku,
          stock: variant.inventory_quantity,
          options: {
            ...(variant.option1 ? { option1: variant.option1 } : {}),
            ...(variant.option2 ? { option2: variant.option2 } : {}),
            ...(variant.option3 ? { option3: variant.option3 } : {})
          }
        })),
        metadata: {
          source: 'shopify',
          sourceUrl: url,
          vendor: data.product.vendor,
          type: data.product.product_type,
          tags: data.product.tags
        }
      };
    } catch (error) {
      console.error('Erreur lors du scraping Shopify:', error);
      throw new Error('Impossible de récupérer le produit. Veuillez vérifier que:\n' +
        '1. L\'URL est correcte\n' +
        '2. Le produit est public\n' +
        '3. La boutique est en ligne');
    }
  },

  async scrapeAliExpress(url: string, options: ScrapingOptions = {}): Promise<ScrapedProduct> {
    try {
      const aliExpressPattern = /^https?:\/\/(?:.*?)\.aliexpress\.com\/item\//i;
      if (!aliExpressPattern.test(url)) {
        throw new Error('URL invalide. Veuillez fournir une URL AliExpress valide.');
      }

      const finalUrl = url;

      const { data } = await axios.get(finalUrl, {
        timeout: options.timeout || 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const $ = cheerio.load(data);

      const title = $('.product-title').text().trim();
      const priceText = $('.product-price-value').text().replace(/[^0-9.,]/g, '').replace(',', '.');
      const price = parseFloat(priceText);
      const images = $('.images-view-item img').map((_, img) => $(img).attr('src') || '').get();
      const description = $('.product-description').html() || '';

      if (!title || isNaN(price)) {
        throw new Error('Données du produit introuvables');
      }

      return {
        title,
        description,
        price,
        images,
        metadata: {
          source: 'aliexpress',
          sourceUrl: url
        }
      };
    } catch (error) {
      console.error('Erreur lors du scraping AliExpress:', error);
      throw new Error('Impossible de récupérer le produit. Veuillez vérifier que:\n' +
        '1. L\'URL est correcte\n' +
        '2. Le produit est disponible\n' +
        '3. Vous n\'etes pas bloqué par AliExpress');
    }
  },

  async scrapeTemu(url: string, options: ScrapingOptions = {}) {
    try {
      const temuPattern = /^https?:\/\/(?:www\.)?temu\.com\/[a-z]{2}\/[^"]+\/[0-9]+\.html/i;
      if (!temuPattern.test(url)) {
        throw new Error('URL invalide. Veuillez fournir une URL Temu valide.');
      }

      throw new Error('Scraping Temu pas encore implémenté');
    } catch (error) {
      console.error('Erreur lors du scraping Temu:', error);
      throw error;
    }
  },

  async scrapeShein(url: string, options: ScrapingOptions = {}) {
    try {
      const sheinPattern = /^https?:\/\/(?:.*?)\.shein\.com/i;
      if (!sheinPattern.test(url)) {
        throw new Error('URL invalide. Veuillez fournir une URL Shein valide.');
      }

      throw new Error('Scraping Shein pas encore implémenté');
    } catch (error) {
      console.error('Erreur lors du scraping Shein:', error);
      throw error;
    }
  },

  async scrapeByUrl(url: string, options: ScrapingOptions = {}): Promise<ScrapedProduct | undefined> {
    if (url.includes('shopify.com') || url.includes('.myshopify.com')) {
      return this.scrapeShopify(url, options);
    } else if (url.includes('aliexpress.com')) {
      return this.scrapeAliExpress(url, options);
    } else if (url.includes('temu.com')) {
      return this.scrapeTemu(url, options);
    } else if (url.includes('shein.com')) {
      return this.scrapeShein(url, options);
    } else {
      throw new Error('Plateforme non supportée. Plateformes disponibles:\n' +
        '- Shopify\n- AliExpress\n- Temu\n- Shein');
    }
  },

  async scrapeCatalog(url: string, options: ScrapingOptions = {}): Promise<ScrapedProduct[]> {
    try {
      if (!url.startsWith('http')) {
        throw new Error('URL invalide');
      }

      const { data } = await axios.get(url, {
        timeout: options.timeout || 15000
      });

      const $ = cheerio.load(data);
      const products: ScrapedProduct[] = [];
      const productLinks = $('a[href*="/products/"], a[href*="/item/"]').map((_, el) => $(el).attr('href') || '').get();

      for (const link of productLinks) {
        try {
          const product = await this.scrapeByUrl(link, options);
          if (product) products.push(product);
        } catch (error) {
          console.warn(`Échec du scraping pour ${link}:`, error);
          continue;
        }
      }

      return products;
    } catch (error) {
      console.error('Erreur lors du scraping du catalogue:', error);
      throw new Error('Impossible de récupérer le catalogue. Veuillez vérifier que:\n' +
        '1. L\'URL est correcte\n' +
        '2. La page est accessible\n' +
        '3. Vous avez les permissions nécessaires');
    }
  }
};
