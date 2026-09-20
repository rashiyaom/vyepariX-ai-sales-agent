import * as cheerio from "cheerio";

export interface ScrapedPage {
  url: string;
  title: string;
  metaDescription?: string;
  text: string;
  fetchedAt: string;
}

export interface ScraperResult {
  success: boolean;
  pages: ScrapedPage[];
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    crunchbase?: string;
    g2?: string;
  };
  warnings: string[];
}

const INTERESTING_PATHS = [
  "about",
  "about-us",
  "services",
  "our-services",
  "products",
  "solutions",
  "portfolio",
  "case-studies",
  "contact",
  "pricing",
];

export const websiteScraperService = {
  /**
   * Scrapes homepage and up to 5 relevant subpages from target website.
   * Extracts visible clean text, metadata, and outbound social links.
   * Graceful: never throws fatal errors, returns warnings instead.
   */
  async scrapeSite(
    targetUrl: string,
    onPageFetched?: (url: string, pageCount: number) => void
  ): Promise<ScraperResult> {
    const result: ScraperResult = {
      success: false,
      pages: [],
      socialLinks: {},
      warnings: [],
    };

    let baseOrigin: string;
    try {
      const parsed = new URL(targetUrl);
      baseOrigin = parsed.origin;
    } catch {
      result.warnings.push(`Invalid target URL: ${targetUrl}`);
      return result;
    }

    // Check robots.txt (best-effort check)
    const robotsAllowed = await checkRobotsTxt(baseOrigin, targetUrl);
    if (!robotsAllowed) {
      result.warnings.push(`Scraping disallowed by robots.txt for ${targetUrl}; proceeding with caution`);
    }

    // 1. Fetch homepage
    try {
      const homePage = await fetchAndParsePage(targetUrl);
      if (homePage) {
        result.pages.push(homePage.page);
        result.socialLinks = homePage.socialLinks;
        result.success = true;
        onPageFetched?.(targetUrl, result.pages.length);

        // 2. Discover internal subpages from links found on homepage
        const candidateLinks = discoverCandidateLinks(homePage.internalLinks, baseOrigin);
        for (const link of candidateLinks.slice(0, 5)) {
          if (result.pages.some((p) => p.url === link)) continue;
          try {
            const subPage = await fetchAndParsePage(link);
            if (subPage) {
              result.pages.push(subPage.page);
              // Merge any additional social links found
              result.socialLinks = { ...subPage.socialLinks, ...result.socialLinks };
              onPageFetched?.(link, result.pages.length);
            }
          } catch (subErr) {
            console.warn(`[Scraper] Subpage fetch error for ${link}:`, subErr);
          }
        }
      } else {
        result.warnings.push(`Could not extract HTML content from ${targetUrl}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Scraper] Homepage fetch error for ${targetUrl}:`, msg);
      result.warnings.push(`Website fetch failed: ${msg}. Continuing with provided description/documents.`);
    }

    return result;
  },
};

async function fetchAndParsePage(
  pageUrl: string
): Promise<{ page: ScrapedPage; socialLinks: ScraperResult["socialLinks"]; internalLinks: string[] } | null> {
  const { default: fetch } = await import("node-fetch");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VyaperiX-Bot/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract title & meta description
    const title = $("title").first().text().trim() || $("h1").first().text().trim() || pageUrl;
    const metaDescription =
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim();

    // Extract social links
    const socialLinks: ScraperResult["socialLinks"] = {};
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (!href) return;
      const lower = href.toLowerCase();
      if (lower.includes("linkedin.com/company") && !socialLinks.linkedin) {
        socialLinks.linkedin = href;
      } else if ((lower.includes("twitter.com/") || lower.includes("x.com/")) && !socialLinks.twitter) {
        socialLinks.twitter = href;
      } else if (lower.includes("facebook.com/") && !socialLinks.facebook) {
        socialLinks.facebook = href;
      } else if (lower.includes("instagram.com/") && !socialLinks.instagram) {
        socialLinks.instagram = href;
      } else if (lower.includes("crunchbase.com/organization") && !socialLinks.crunchbase) {
        socialLinks.crunchbase = href;
      } else if (lower.includes("g2.com/products") && !socialLinks.g2) {
        socialLinks.g2 = href;
      }
    });

    // Discover internal links
    const internalLinks: string[] = [];
    const origin = new URL(pageUrl).origin;
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href")?.trim();
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:")) return;
      try {
        const resolved = new URL(href, pageUrl);
        if (resolved.origin === origin && !internalLinks.includes(resolved.href)) {
          internalLinks.push(resolved.href);
        }
      } catch {
        // Ignore malformed href
      }
    });

    // Strip unneeded tags for clean text content
    $("script, style, noscript, svg, nav, footer, header, form, iframe").remove();

    // Extract readable text
    let text = $("body").text();
    text = text
      .replace(/\s+/g, " ")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    // Truncate to reasonable max token length per page (~3000 chars)
    if (text.length > 4000) {
      text = text.slice(0, 4000) + "...";
    }

    return {
      page: {
        url: pageUrl,
        title,
        metaDescription,
        text,
        fetchedAt: new Date().toISOString(),
      },
      socialLinks,
      internalLinks,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function discoverCandidateLinks(links: string[], origin: string): string[] {
  const candidates: { url: string; score: number }[] = [];

  for (const raw of links) {
    try {
      const u = new URL(raw, origin);
      if (u.origin !== origin) continue;
      const path = u.pathname.toLowerCase().replace(/\/$/, "");
      if (!path) continue;

      let score = 0;
      for (const pattern of INTERESTING_PATHS) {
        if (path.includes(pattern)) {
          score += 10;
        }
      }
      if (score > 0) {
        candidates.push({ url: u.href, score });
      }
    } catch {
      // Ignore
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return Array.from(new Set(candidates.map((c) => c.url)));
}

async function checkRobotsTxt(origin: string, targetUrl: string): Promise<boolean> {
  try {
    const { default: fetch } = await import("node-fetch");
    const robotsUrl = `${origin}/robots.txt`;
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return true; // if no robots.txt, allowed by default
    const text = await res.text();
    const pathname = new URL(targetUrl).pathname;
    if (text.includes("Disallow: /") && !text.includes("Disallow: /admin")) {
      // Check if general disallow
      const lines = text.split("\n");
      for (const line of lines) {
        const trimmed = line.trim().toLowerCase();
        if (trimmed === "disallow: /" || trimmed === "disallow: /*") {
          return false;
        }
        if (trimmed.startsWith("disallow:") && pathname.startsWith(trimmed.replace("disallow:", "").trim())) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return true;
  }
}
