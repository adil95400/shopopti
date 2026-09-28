/* global chrome, document, DOMParser, fetch, URL, window */

(() => {
  const cleanText = (value) => (value || '').replace(/\s+/g, ' ').trim();

  const absoluteUrl = (value) => {
    if (!value) return null;
    try {
      return new URL(value, window.location.href).href;
    } catch {
      return null;
    }
  };

  const firstMeta = (...selectors) => {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const value = node?.getAttribute('content');
      if (value) return cleanText(value);
    }
    return '';
  };

  const readJsonLd = () => {
    const products = [];
    const blocks = [...document.querySelectorAll('script[type="application/ld+json"]')];

    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block.textContent || 'null');
        const entries = Array.isArray(parsed) ? parsed : [parsed];

        for (const entry of entries) {
          if (!entry || typeof entry !== 'object') continue;
          const type = Array.isArray(entry['@type']) ? entry['@type'] : [entry['@type']];
          if (type.includes('ProductGroup')) return entry;
          if (type.includes('Product')) products.push(entry);
        }
      } catch {
        // Ignore malformed third-party JSON-LD and continue with safe fallbacks.
      }
    }

    return products[0] || null;
  };

  const collectImages = (jsonLd) => {
    const values = new Set();

    const add = (value) => {
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      const url = absoluteUrl(value);
      if (url && /^https?:/.test(url)) values.add(url);
    };

    add(jsonLd?.image);
    add(firstMeta('meta[property="og:image"]', 'meta[name="twitter:image"]'));

    document.querySelectorAll('img').forEach((image) => {
      const src = image.currentSrc || image.getAttribute('src') || image.getAttribute('data-src');
      const url = absoluteUrl(src);
      if (!url) return;
      const rect = image.getBoundingClientRect();
      if (rect.width >= 120 && rect.height >= 120) values.add(url);
    });

    return [...values].slice(0, 30);
  };

  const collectVideos = (jsonLd) => {
    const values = new Set();

    const add = (value) => {
      if (Array.isArray(value)) {
        value.forEach(add);
        return;
      }
      if (value && typeof value === 'object') {
        add(value.contentUrl || value.embedUrl || value.url);
        return;
      }
      const url = absoluteUrl(value);
      if (url && /^https?:/.test(url)) values.add(url);
    };

    add(jsonLd?.video);
    add(firstMeta(
      'meta[property="og:video"]',
      'meta[property="og:video:url"]',
      'meta[property="og:video:secure_url"]',
      'meta[name="twitter:player:stream"]'
    ));

    document.querySelectorAll('video, video source').forEach((node) => {
      add(node.currentSrc || node.getAttribute('src'));
    });

    return [...values].slice(0, 10);
  };

  const structuredReviewList = (jsonLd) => {
    const raw = jsonLd?.review;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  };

  const collectStructuredReviews = (jsonLd) => {
    return structuredReviewList(jsonLd).flatMap((review, index) => {
      if (!review || typeof review !== 'object') return [];

      const rawRating = review.reviewRating?.ratingValue ?? review.ratingValue;
      const rating = rawRating === undefined || rawRating === null
        ? null
        : Number.parseFloat(String(rawRating));

      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return [];

      const text = cleanText(review.reviewBody || review.description || '');
      const author = entityName(review.author) || 'Anonymous';
      const date = cleanText(review.datePublished || '') || null;
      const title = cleanText(review.name || review.headline || '') || null;
      const helpfulRaw = review.interactionStatistic?.userInteractionCount ?? review.helpfulCount;
      const helpfulValue = numberValue(helpfulRaw);
      const purchasedVariant = cleanText(
        review.itemReviewed?.name ||
        review.itemReviewed?.sku ||
        review.productVariant ||
        review.variant ||
        ''
      ) || null;

      const images = [];
      const videos = [];

      const pushMedia = (value, target) => {
        const values = Array.isArray(value) ? value : [value];
        values.forEach((entry) => {
          if (!entry) return;
          const candidate = typeof entry === 'object'
            ? entry.contentUrl || entry.embedUrl || entry.url
            : entry;
          const url = absoluteUrl(candidate);
          if (url && /^https?:/.test(url) && !target.includes(url)) target.push(url);
        });
      };

      pushMedia(review.image, images);
      pushMedia(review.video, videos);

      const associated = Array.isArray(review.associatedMedia)
        ? review.associatedMedia
        : review.associatedMedia ? [review.associatedMedia] : [];

      associated.forEach((media) => {
        if (!media || typeof media !== 'object') return;
        const type = Array.isArray(media['@type']) ? media['@type'] : [media['@type']];
        if (type.includes('VideoObject')) pushMedia(media, videos);
        else if (type.includes('ImageObject')) pushMedia(media, images);
      });

      return [{
        externalId: cleanText(review['@id'] || '') || `structured-${index + 1}`,
        rating,
        title,
        text,
        author,
        date,
        country: entityName(review.author?.address?.addressCountry) || null,
        verifiedPurchase: false,
        helpfulCount: helpfulValue !== null && helpfulValue >= 0 ? Math.trunc(helpfulValue) : null,
        purchasedVariant,
        images: images.slice(0, 10),
        videos: videos.slice(0, 5),
        source: 'json-ld'
      }];
    }).slice(0, 100);
  };

  const collectReviewDistribution = (jsonLd) => {
    const candidates = jsonLd?.aggregateRating?.ratingDistribution || jsonLd?.aggregateRating?.ratingCountByValue;
    if (!candidates) return null;
    const distribution = {};
    const entries = Array.isArray(candidates) ? candidates : Object.entries(candidates).map(([rating, count]) => ({ ratingValue: rating, ratingCount: count }));
    entries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const rating = numberValue(entry.ratingValue ?? entry.rating);
      const count = numberValue(entry.ratingCount ?? entry.count);
      if (Number.isInteger(rating) && rating >= 1 && rating <= 5 && count !== null && count >= 0) {
        distribution[String(rating)] = Math.trunc(count);
      }
    });
    return Object.keys(distribution).length ? distribution : null;
  };

  const collectReviewPageNextUrl = (jsonLd, doc = document) => {
    const structured = jsonLd?.review?.next || jsonLd?.reviews?.next || jsonLd?.reviewPagination?.next;
    const fromStructured = absoluteUrl(structured);
    if (fromStructured) return fromStructured;

    const node = doc.querySelector('link[rel="next"], a[rel="next"]');
    const candidate = node?.getAttribute('href');
    return absoluteUrl(candidate);
  };

  const collectPaginatedReviews = async (initialJsonLd, initialReviews, reviewCount) => {
    const reviews = [...initialReviews];
    const seenReviews = new Set(
      reviews.map((review) => [review.externalId, review.author, review.date, review.text].join('|'))
    );
    const seenPages = new Set();
    let nextUrl = collectReviewPageNextUrl(initialJsonLd);
    let pagesFetched = 0;

    while (nextUrl && pagesFetched < 9 && reviews.length < 500) {
      let parsedUrl;
      try {
        parsedUrl = new URL(nextUrl, window.location.href);
      } catch {
        break;
      }

      if (parsedUrl.origin !== window.location.origin || seenPages.has(parsedUrl.href)) break;
      seenPages.add(parsedUrl.href);

      let response;
      try {
        response = await fetch(parsedUrl.href, {
          credentials: 'include',
          redirect: 'follow',
          headers: { accept: 'text/html,application/xhtml+xml' }
        });
      } catch {
        break;
      }

      if (!response.ok) break;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) break;

      const html = await response.text();
      if (html.length > 3_000_000) break;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const blocks = [...doc.querySelectorAll('script[type="application/ld+json"]')];
      let pageJsonLd = null;

      for (const block of blocks) {
        try {
          const parsed = JSON.parse(block.textContent || 'null');
          const entries = Array.isArray(parsed) ? parsed : [parsed];
          for (const entry of entries) {
            if (!entry || typeof entry !== 'object') continue;
            const type = Array.isArray(entry['@type']) ? entry['@type'] : [entry['@type']];
            if (type.includes('Product') || type.includes('ProductGroup')) {
              pageJsonLd = entry;
              break;
            }
          }
        } catch {
          // Ignore malformed JSON-LD on paginated review pages.
        }
        if (pageJsonLd) break;
      }

      if (!pageJsonLd) break;

      const pageReviews = collectStructuredReviews(pageJsonLd);
      for (const review of pageReviews) {
        const key = [review.externalId, review.author, review.date, review.text].join('|');
        if (seenReviews.has(key)) continue;
        seenReviews.add(key);
        reviews.push(review);
        if (reviews.length >= 500) break;
      }

      pagesFetched += 1;
      nextUrl = collectReviewPageNextUrl(pageJsonLd, doc);
    }

    return {
      reviews,
      pagesFetched,
      nextUrl: nextUrl || null,
      complete: Number.isFinite(reviewCount)
        ? reviews.length >= reviewCount
        : !nextUrl
    };
  };

  const collectReviewPagination = (jsonLd, reviewCount, reviews, pageResult = null) => {
    const nextUrl = pageResult?.nextUrl || collectReviewPageNextUrl(jsonLd);
    const pageSize = reviews.length || null;
    if (!nextUrl && !(reviewCount > reviews.length && reviews.length > 0) && !pageResult?.pagesFetched) return null;
    return {
      captured: reviews.length,
      total: Number.isFinite(reviewCount) ? reviewCount : null,
      pageSize,
      pagesFetched: pageResult?.pagesFetched || 0,
      nextUrl: nextUrl || null,
      complete: pageResult
        ? Boolean(pageResult.complete)
        : Number.isFinite(reviewCount) ? reviews.length >= reviewCount : false
    };
  };

  const normalizeOffer = (offers) => {
    if (Array.isArray(offers)) return offers[0] || {};
    return offers && typeof offers === 'object' ? offers : {};
  };

  const entityName = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return cleanText(value) || null;
    if (typeof value === 'object') {
      const name = cleanText(value.name || value.legalName || '');
      return name || null;
    }
    return null;
  };

  const numberValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object' && value !== null) {
      return numberValue(value.value ?? value.minValue ?? value.maxValue);
    }
    const parsed = Number.parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const unitValue = (value) => {
    if (!value) return null;
    if (typeof value === 'object' && value !== null) {
      return cleanText(value.unitCode || value.unitText || '') || null;
    }
    return null;
  };

  const collectStructuredAttributes = (jsonLd) => {
    const attributes = {};
    const values = Array.isArray(jsonLd?.additionalProperty)
      ? jsonLd.additionalProperty
      : jsonLd?.additionalProperty ? [jsonLd.additionalProperty] : [];

    values.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const name = cleanText(entry.name || entry.propertyID || '');
      if (!name || Object.keys(attributes).length >= 100) return;

      const rawValue = entry.value ?? entry.valueReference ?? entry.description;
      const value = typeof rawValue === 'object' && rawValue !== null
        ? cleanText(rawValue.name || rawValue.value || '')
        : cleanText(String(rawValue ?? ''));

      if (value) attributes[name] = value;
    });

    return attributes;
  };

  const collectSourceKeywords = (jsonLd) => {
    const values = [];
    const add = (value) => {
      const entries = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [value];
      entries.forEach((entry) => {
        const keyword = cleanText(typeof entry === 'object' && entry ? entry.name || '' : String(entry || ''));
        if (keyword && keyword.length <= 120 && !values.includes(keyword)) values.push(keyword);
      });
    };

    add(jsonLd?.keywords);
    add(firstMeta('meta[name="keywords"]'));

    return values.slice(0, 50);
  };

  const collectSourceTags = (jsonLd) => {
    const values = [];
    const add = (value) => {
      const entries = Array.isArray(value) ? value : [value];
      entries.forEach((entry) => {
        const tag = entityName(entry);
        if (tag && tag.length <= 120 && !values.includes(tag)) values.push(tag);
      });
    };

    add(jsonLd?.category);
    add(jsonLd?.additionalType);

    return values.slice(0, 30);
  };

  const collectStructuredDimensions = (jsonLd) => {
    const weight = numberValue(jsonLd?.weight);
    const width = numberValue(jsonLd?.width);
    const height = numberValue(jsonLd?.height);
    const length = numberValue(jsonLd?.depth);

    return {
      weight,
      weightUnit: unitValue(jsonLd?.weight),
      dimensions: (width !== null || height !== null || length !== null)
        ? {
            width,
            height,
            length,
            unit: unitValue(jsonLd?.width) || unitValue(jsonLd?.height) || unitValue(jsonLd?.depth)
          }
        : null
    };
  };

  const collectBreadcrumbs = (jsonLd) => {
    const values = [];
    const add = (value) => {
      const label = entityName(value);
      if (label && !values.includes(label)) values.push(label);
    };
    const category = jsonLd?.category;
    if (Array.isArray(category)) category.forEach(add);
    else if (typeof category === 'string') category.split(/\s*[>›/]\s*/).forEach(add);
    else add(category);

    document.querySelectorAll('nav[aria-label*="breadcrumb" i] a, [class*="breadcrumb" i] a').forEach((node) => add(node.textContent));
    return values.slice(0, 20);
  };

  const collectSellerDetails = (jsonLd, offer) => {
    const raw = offer?.seller || jsonLd?.seller;
    if (!raw || typeof raw !== 'object') {
      return { name: entityName(raw), id: null, url: null, rating: null, foundingDate: null };
    }
    const rating = numberValue(raw.aggregateRating?.ratingValue);
    return {
      name: entityName(raw),
      id: cleanText(raw['@id'] || raw.identifier || '') || null,
      url: absoluteUrl(raw.url) || null,
      rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null,
      foundingDate: cleanText(raw.foundingDate || raw.foundingDateTime || raw.dateCreated || '') || null
    };
  };

  const collectStructuredShipping = (offer) => {
    const rawDetails = offer?.shippingDetails;
    const details = Array.isArray(rawDetails) ? rawDetails : rawDetails ? [rawDetails] : [];

    return details.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return [];

      const rate = entry.shippingRate;
      const amount = numberValue(rate);
      const currency = typeof rate === 'object' && rate !== null
        ? cleanText(rate.currency || rate.priceCurrency || '') || null
        : null;

      const destination = entry.shippingDestination || {};
      const countries = destination.addressCountry;
      const countryList = Array.isArray(countries) ? countries : countries ? [countries] : [];

      const handling = entry.deliveryTime?.handlingTime || {};
      const transit = entry.deliveryTime?.transitTime || {};

      return [{
        cost: amount,
        currency,
        countries: countryList
          .map((country) => entityName(country))
          .filter(Boolean)
          .slice(0, 50),
        method: entityName(entry.shippingMethod) || cleanText(entry.shippingMethod || '') || null,
        carrier: entityName(entry.shippingCarrier || entry.carrier || entry.provider) || null,
        shipFrom: entityName(entry.shippingOrigin?.addressCountry || entry.originAddress?.addressCountry) || null,
        freeShipping: amount === 0 ? true : null,
        handlingDays: {
          min: numberValue(handling.minValue),
          max: numberValue(handling.maxValue),
          unit: cleanText(handling.unitCode || handling.unitText || '') || null
        },
        transitDays: {
          min: numberValue(transit.minValue),
          max: numberValue(transit.maxValue),
          unit: cleanText(transit.unitCode || transit.unitText || '') || null
        }
      }];
    }).slice(0, 20);
  };

  const collectIdentifiers = (jsonLd) => ({
    gtin: cleanText(jsonLd?.gtin || jsonLd?.gtin13 || jsonLd?.gtin14 || jsonLd?.gtin12 || jsonLd?.gtin8 || '') || null,
    ean: cleanText(jsonLd?.gtin13 || jsonLd?.gtin || '') || null,
    upc: cleanText(jsonLd?.gtin12 || '') || null,
    mpn: cleanText(jsonLd?.mpn || '') || null,
    sku: cleanText(jsonLd?.sku || '') || null
  });

  const collectStructuredVariants = (jsonLd) => {
    if (!Array.isArray(jsonLd?.hasVariant)) return [];

    const optionFields = ['color', 'size', 'material', 'pattern', 'suggestedAge', 'suggestedGender', 'model', 'capacity', 'memory', 'storage', 'voltage', 'plugType', 'quantity'];

    return jsonLd.hasVariant.flatMap((variant) => {
      if (!variant || typeof variant !== 'object') return [];

      const variantOffer = normalizeOffer(variant.offers);
      const rawVariantPrice = variantOffer.price ?? variantOffer.lowPrice;
      const rawVariantCompareAtPrice =
        variantOffer.highPrice ??
        variantOffer.priceSpecification?.referencePrice ??
        variantOffer.priceSpecification?.priceBeforeDiscount;
      const variantPrice = rawVariantPrice === undefined || rawVariantPrice === null || rawVariantPrice === ''
        ? null
        : Number.parseFloat(String(rawVariantPrice).replace(',', '.'));

      if (!Number.isFinite(variantPrice)) return [];

      const variantCompareAtPrice = rawVariantCompareAtPrice === undefined || rawVariantCompareAtPrice === null || rawVariantCompareAtPrice === ''
        ? null
        : Number.parseFloat(String(rawVariantCompareAtPrice).replace(',', '.'));

      const options = {};
      for (const field of optionFields) {
        const value = entityName(variant[field]);
        if (value) options[field] = value;
      }

      const variantProperties = Array.isArray(variant.additionalProperty)
        ? variant.additionalProperty
        : variant.additionalProperty ? [variant.additionalProperty] : [];

      variantProperties.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const name = cleanText(entry.name || entry.propertyID || '');
        if (!name || Object.keys(options).length >= 30) return;
        const rawValue = entry.value ?? entry.valueReference ?? entry.description;
        const value = typeof rawValue === 'object' && rawValue !== null
          ? cleanText(rawValue.name || rawValue.value || '')
          : cleanText(String(rawValue ?? ''));
        if (value && !options[name]) options[name] = value;
      });

      const title = cleanText(variant.name || Object.values(options).join(' / ')) || 'Variante';
      const sku = cleanText(variant.sku || variant.productID || '');
      const rawStock = variantOffer.inventoryLevel?.value ?? variantOffer.inventoryLevel;
      const stock = rawStock === undefined || rawStock === null || rawStock === ''
        ? null
        : Number.parseInt(String(rawStock), 10);
      const availability = cleanText(variantOffer.availability || '') || null;

      const variantImages = [];
      const addVariantImage = (value) => {
        const values = Array.isArray(value) ? value : [value];
        values.forEach((entry) => {
          const candidate = typeof entry === 'object' && entry
            ? entry.contentUrl || entry.url
            : entry;
          const url = absoluteUrl(candidate);
          if (url && /^https?:/.test(url) && !variantImages.includes(url)) variantImages.push(url);
        });
      };
      addVariantImage(variant.image);

      return [{
        id: cleanText(variant['@id'] || variant.productID || variant.sku || '') || undefined,
        title,
        price: variantPrice,
        compareAtPrice: Number.isFinite(variantCompareAtPrice) && variantCompareAtPrice > variantPrice
          ? variantCompareAtPrice
          : null,
        currency: cleanText(variantOffer.priceCurrency || '') || null,
        sku: sku || undefined,
        stock: Number.isFinite(stock) && stock >= 0 ? stock : null,
        availability,
        images: variantImages.slice(0, 5),
        options
      }];
    });
  };

  const extractProduct = async () => {
    if (!/\.aliexpress\.com$/i.test(window.location.hostname) || !/\/item\//i.test(window.location.pathname)) {
      return {
        ok: false,
        error: 'Cette page n’est pas une fiche produit AliExpress prise en charge.'
      };
    }

    const jsonLd = readJsonLd();
    const offer = normalizeOffer(jsonLd?.offers);

    const title = cleanText(
      jsonLd?.name ||
      firstMeta('meta[property="og:title"]', 'meta[name="twitter:title"]') ||
      document.querySelector('h1')?.textContent ||
      document.title
    );

    const description = cleanText(
      jsonLd?.description ||
      firstMeta('meta[property="og:description"]', 'meta[name="description"]')
    );

    const rawPrice =
      offer.price ||
      offer.lowPrice ||
      firstMeta('meta[property="product:price:amount"]', 'meta[itemprop="price"]');

    const price = rawPrice === undefined || rawPrice === null || rawPrice === ''
      ? null
      : Number.parseFloat(String(rawPrice).replace(',', '.'));

    const rawCompareAtPrice =
      offer.highPrice ??
      offer.priceSpecification?.referencePrice ??
      offer.priceSpecification?.priceBeforeDiscount;
    const compareAtPriceValue = rawCompareAtPrice === undefined || rawCompareAtPrice === null || rawCompareAtPrice === ''
      ? null
      : Number.parseFloat(String(rawCompareAtPrice).replace(',', '.'));
    const compareAtPrice = Number.isFinite(compareAtPriceValue) && Number.isFinite(price) && compareAtPriceValue > price
      ? compareAtPriceValue
      : null;
    const discountPercent = compareAtPrice !== null && price > 0
      ? Math.round(((compareAtPrice - price) / compareAtPrice) * 10000) / 100
      : null;
    const priceValidUntil = cleanText(offer.priceValidUntil || '') || null;
    const identifiers = collectIdentifiers(jsonLd);

    const currency = cleanText(
      offer.priceCurrency ||
      firstMeta('meta[property="product:price:currency"]', 'meta[itemprop="priceCurrency"]')
    ) || null;

    const sellerDetails = collectSellerDetails(jsonLd, offer);
    const seller = sellerDetails.name;
    const brand = entityName(jsonLd?.brand);
    const category = cleanText(jsonLd?.category || '') || null;
    const breadcrumbs = collectBreadcrumbs(jsonLd);
    const minimumOrderQuantity = numberValue(offer.eligibleQuantity?.minValue ?? offer.minimumOrderQuantity ?? jsonLd?.minimumOrderQuantity);
    const packSize = numberValue(
      jsonLd?.numberOfItems ??
      jsonLd?.unitPricingMeasure?.value ??
      offer?.eligibleQuantity?.value ??
      null
    );
    const condition = cleanText(jsonLd?.itemCondition || '') || null;
    const taxIncluded = typeof offer.priceSpecification?.valueAddedTaxIncluded === 'boolean'
      ? offer.priceSpecification.valueAddedTaxIncluded
      : null;
    const priceCountry = entityName(offer.eligibleRegion?.addressCountry || offer.areaServed) || null;
    const interactionType = cleanText(jsonLd?.interactionStatistic?.interactionType?.['@type'] || jsonLd?.interactionStatistic?.interactionType || '');
    const rawSoldCount = numberValue(jsonLd?.interactionStatistic?.userInteractionCount);
    const soldCount = /Order|Purchase|BuyAction/i.test(interactionType) ? rawSoldCount : null;
    const model = cleanText(jsonLd?.model || jsonLd?.mpn || '') || null;
    const sourceKeywords = collectSourceKeywords(jsonLd);
    const sourceTags = collectSourceTags(jsonLd);
    const attributes = collectStructuredAttributes(jsonLd);
    const physical = collectStructuredDimensions(jsonLd);
    const shipping = collectStructuredShipping(offer);
    const images = collectImages(jsonLd);
    const videos = collectVideos(jsonLd);
    const variants = collectStructuredVariants(jsonLd);
    const initialReviews = collectStructuredReviews(jsonLd);
    const rawAggregateRating = jsonLd?.aggregateRating?.ratingValue;
    const rawReviewCount = jsonLd?.aggregateRating?.reviewCount ?? jsonLd?.aggregateRating?.ratingCount;
    const aggregateRating = rawAggregateRating == null
      ? null
      : Number.parseFloat(String(rawAggregateRating));
    const reviewCount = rawReviewCount == null
      ? null
      : Number.parseInt(String(rawReviewCount), 10);
    const paginatedReviews = await collectPaginatedReviews(jsonLd, initialReviews, reviewCount);
    const reviews = paginatedReviews.reviews;
    const reviewDistribution = collectReviewDistribution(jsonLd);
    const reviewPagination = collectReviewPagination(jsonLd, reviewCount, reviews, paginatedReviews);
    const canonicalUrl = absoluteUrl(document.querySelector('link[rel="canonical"]')?.getAttribute('href')) || null;
    const productIdMatch = window.location.pathname.match(/\/item\/(\d+)\.html/i);

    const payload = {
      schemaVersion: 1,
      source: 'aliexpress',
      sourceUrl: window.location.href,
      canonicalUrl,
      extractedAt: new Date().toISOString(),
      productId: productIdMatch?.[1] || null,
      title,
      description,
      price: Number.isFinite(price) ? price : null,
      compareAtPrice,
      discountPercent,
      priceValidUntil,
      currency,
      identifiers,
      images,
      videos,
      reviews,
      aggregateRating: Number.isFinite(aggregateRating) ? aggregateRating : null,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : null,
      reviewDistribution,
      reviewPagination,
      availability: cleanText(offer.availability || '') || null,
      seller,
      sellerDetails,
      brand,
      category,
      breadcrumbs,
      minimumOrderQuantity,
      packSize,
      condition,
      taxIncluded,
      priceCountry,
      soldCount,
      model,
      sourceKeywords,
      sourceTags,
      attributes,
      weight: physical.weight,
      weightUnit: physical.weightUnit,
      dimensions: physical.dimensions,
      shipping,
      variants,
      extraction: {
        method: jsonLd ? 'json-ld+dom-fallback' : 'dom-fallback',
        verifiedFields: {
          title: Boolean(title),
          price: Number.isFinite(price),
          compareAtPrice: compareAtPrice !== null,
          promotion: discountPercent !== null || Boolean(priceValidUntil),
          identifiers: Object.values(identifiers).some(Boolean),
          currency: Boolean(currency),
          images: images.length > 0,
          videos: videos.length > 0,
          reviews: reviews.length > 0,
          aggregateRating: Number.isFinite(aggregateRating),
          reviewCount: Number.isFinite(reviewCount),
          reviewDistribution: Boolean(reviewDistribution),
          reviewPagination: Boolean(reviewPagination),
          reviewHelpfulCounts: reviews.some((review) => review.helpfulCount !== null),
          reviewPurchasedVariants: reviews.some((review) => Boolean(review.purchasedVariant)),
          seller: Boolean(seller),
          sellerDetails: Boolean(sellerDetails.id || sellerDetails.url || sellerDetails.rating !== null),
          breadcrumbs: breadcrumbs.length > 0,
          minimumOrderQuantity: minimumOrderQuantity !== null,
          packSize: packSize !== null,
          canonicalUrl: Boolean(canonicalUrl),
          condition: Boolean(condition),
          taxIncluded: taxIncluded !== null,
          priceCountry: Boolean(priceCountry),
          soldCount: soldCount !== null,
          brand: Boolean(brand),
          category: Boolean(category),
          sourceKeywords: sourceKeywords.length > 0,
          sourceTags: sourceTags.length > 0,
          attributes: Object.keys(attributes).length > 0,
          weight: physical.weight !== null,
          dimensions: Boolean(physical.dimensions),
          shipping: shipping.length > 0,
          variants: variants.length > 0
        }
      }
    };

    if (!payload.title) {
      return {
        ok: false,
        error: 'Le titre du produit n’a pas pu être extrait de manière fiable.'
      };
    }

    return { ok: true, product: payload };
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'SHOPOPTI_EXTRACT_PRODUCT') return;
    void extractProduct()
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: 'Échec de l’extraction AliExpress.' }));
    return true;
  });
})();
