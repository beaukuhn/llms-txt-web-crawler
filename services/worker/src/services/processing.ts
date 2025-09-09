// src/services/processing.ts - Website content processing

import axios from "axios";
import * as cheerio from "cheerio";
import Sitemapper from "sitemapper";
import pLimit from "p-limit";
import { PageMeta } from "../types";
import { createFilter } from "../utils/validation";
import { formatError, logInfo, logError } from "../utils/logging";
import {
  MAX_DEPTH,
  MAX_URLS,
  REQUEST_CONCURRENCY,
  SITE_REQUEST_TIMEOUT,
} from "../constants";
import { StatusCodes } from "http-status-codes";

/**
 * Extract sitemaps from robots.txt file
 * @param baseUrl The base URL of the site
 * @returns Array of sitemap URLs
 */
export async function getSitemapsFromRobotsTxt(
  baseUrl: string
): Promise<string[]> {
  try {
    const robotsTxtUrl = new URL("/robots.txt", baseUrl).toString();
    logInfo(`Checking robots.txt at ${robotsTxtUrl}`);

    const response = await axios.get(robotsTxtUrl, {
      timeout: SITE_REQUEST_TIMEOUT,
    });
    const robotsTxt = response.data;

    // Extract sitemap URLs from robots.txt
    const sitemapRegex = /Sitemap:\s*(\S+)/gi;
    const sitemaps: string[] = [];
    let match;

    while ((match = sitemapRegex.exec(robotsTxt)) !== null) {
      if (match[1]) {
        sitemaps.push(match[1]);
      }
    }

    logInfo(
      `Found ${sitemaps.length} sitemaps in robots.txt: ${sitemaps.join(", ")}`
    );
    return sitemaps;
  } catch (error) {
    logInfo(`Error fetching robots.txt: ${formatError(error)}`);
    return [];
  }
}

/**
 * Fetch URLs from sitemap
 * @param baseUrl The base URL of the site
 * @returns Array of URLs found in sitemaps
 */
export async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  // First check robots.txt for sitemaps
  const robotsTxtSitemaps = await getSitemapsFromRobotsTxt(baseUrl);

  for (const sitemapUrl of robotsTxtSitemaps) {
    try {
      logInfo(`Trying sitemap from robots.txt: ${sitemapUrl}`);
      const mapper = new Sitemapper({
        url: sitemapUrl,
        timeout: SITE_REQUEST_TIMEOUT,
      });
      const { sites } = await mapper.fetch();
      const urls = sites || [];

      if (urls.length > 0) {
        logInfo(
          `Successfully found ${urls.length} URLs from robots.txt sitemap: ${sitemapUrl}`
        );
        return urls;
      }
    } catch (error) {
      logInfo(
        `Error with robots.txt sitemap ${sitemapUrl}: ${formatError(error)}`
      );
      // Continue to try next sitemap
    }
  }

  // If robots.txt approach failed, fall back to standard sitemap.xml
  logInfo(
    "No valid sitemaps found in robots.txt, trying standard locations..."
  );

  // Try HTTPS first (some sites give different sitemaps over HTTP and HTTPS)
  const secureUrl = baseUrl.replace(/^http:/, "https:");
  const sitemapUrl = `${secureUrl.replace(/\/$/, "")}/sitemap.xml`;

  try {
    const mapper = new Sitemapper({
      url: sitemapUrl,
      timeout: SITE_REQUEST_TIMEOUT,
    });
    const { sites } = await mapper.fetch();
    return sites || [];
  } catch (error) {
    logInfo(`Error with standard sitemap: ${formatError(error)}`);
    return [];
  }
}

/**
 * BFS crawl to discover site URLs
 * @param startUrl The starting URL for crawl
 * @param filter Function to filter URLs
 * @returns Array of PageMeta objects
 */
export async function bfsCrawl(
  startUrl: string,
  filter: (url: string) => boolean
): Promise<PageMeta[]> {
  const queue: { url: string; depth: number }[] = [{ url: startUrl, depth: 0 }];
  const seen = new Set<string>();
  const limiter = pLimit(REQUEST_CONCURRENCY);
  const results: PageMeta[] = [];

  while (queue.length && results.length < MAX_URLS) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url) || depth > MAX_DEPTH) continue;
    seen.add(url);

    await limiter(async () => {
      try {
        const { data, status } = await axios.get(url, {
          timeout: SITE_REQUEST_TIMEOUT,
        });
        if (status !== StatusCodes.OK) return;

        const $ = cheerio.load(data);
        results.push({
          url,
          title: $("head > title").text().trim() || url,
          desc: $('meta[name="description"]').attr("content") || "",
        });

        $("a[href]").each((_, el) => {
          try {
            const href = new URL($(el).attr("href")!, url).toString();
            if (href.startsWith(startUrl) && filter(href) && !seen.has(href)) {
              queue.push({ url: href, depth: depth + 1 });
            }
          } catch (e) {
            // Skip invalid URLs
          }
        });
      } catch (error) {
        // Log and continue - don't let one page failure stop the whole crawl
        logInfo(`Error crawling ${url}: ${formatError(error)}`);
      }
    });
  }

  return results;
}

/**
 * Enriches basic metadata for pages
 * @param pages Array of pages to enrich
 * @returns Array of pages with enriched metadata
 */
export async function enrichBasicMetadata(
  pages: PageMeta[]
): Promise<PageMeta[]> {
  if (pages.length === 0 || pages[0].title !== "") {
    return pages;
  }

  logInfo(
    `Enriching page metadata for ${pages.length} pages (limited to ${REQUEST_CONCURRENCY} concurrent requests)`
  );
  const enrichLimiter = pLimit(REQUEST_CONCURRENCY);

  // Enrich all pages with basic metadata
  await Promise.all(
    pages.map((p) =>
      enrichLimiter(async () => {
        try {
          const { data } = await axios.get(p.url, {
            timeout: SITE_REQUEST_TIMEOUT,
          });
          const $ = cheerio.load(data);
          p.title = $("head > title").text().trim() || p.url;
          p.desc = $('meta[name="description"]').attr("content") || "";
        } catch (error) {
          // If we can't enrich, just use the URL as title
          p.title = p.url;
        }
      })
    )
  );

  logInfo(`Successfully enriched basic metadata for ${pages.length} pages`);

  // Filter out pages without a title
  return pages.filter((p) => p.title !== "[]" && p.title.trim() !== "");
}

/**
 * Fetches site title and description from base URL
 * @param baseUrl The base URL of the site
 * @returns Object containing site title and description
 */
export async function fetchSiteInfo(
  baseUrl: string
): Promise<{ title: string; desc: string }> {
  let siteTitle = baseUrl;
  let siteDesc = "";

  try {
    const { data } = await axios.get(baseUrl, {
      timeout: SITE_REQUEST_TIMEOUT,
    });
    const $ = cheerio.load(data);
    siteTitle = $("head > title").text().trim() || siteTitle;
    siteDesc = $('meta[name="description"]').attr("content") || "";
  } catch (error) {
    logInfo(
      `Couldn't fetch base page, using domain as title: ${formatError(error)}`
    );
  }

  return { title: siteTitle, desc: siteDesc };
}

/**
 * Categorizes a URL based on its path and title
 * @param page PageMeta object
 * @returns Category for the page
 */
export function categorizeURL(page: PageMeta): string {
  const url = page.url.toLowerCase();
  const title = page.title.toLowerCase();

  // Check for documentation pages
  if (
    url.includes("/docs/") ||
    url.includes("/documentation/") ||
    title.includes("documentation") ||
    title.includes("manual") ||
    title.includes("reference")
  ) {
    return "docs";
  }

  // Check for example pages
  if (
    url.includes("/examples/") ||
    url.includes("/sample/") ||
    title.includes("example") ||
    title.includes("sample") ||
    title.includes("demo")
  ) {
    return "examples";
  }

  // Check for tutorial pages
  if (
    url.includes("/tutorial/") ||
    url.includes("/learn/") ||
    title.includes("tutorial") ||
    title.includes("learn") ||
    title.includes("how to")
  ) {
    return "tutorial";
  }

  // Default category
  return "other";
}

/**
 * Formats pages into LLMs.txt format
 * @param title Site title
 * @param desc Site description
 * @param pages Array of pages
 * @returns Formatted LLMs.txt content
 */
export function formatLLMsTxt(
  title: string,
  desc: string,
  pages: PageMeta[]
): string {
  let txt = `# ${title}\n\n`;

  // Add description if it exists
  if (desc) {
    txt += `> ${desc}\n\n`;
  }

  // Group pages by category
  const pagesByCategory = pages.reduce((acc, page) => {
    const category = categorizeURL(page);
    page.category = category; // Store category in the page object
    if (!acc[category]) acc[category] = [];
    acc[category].push(page);
    return acc;
  }, {} as Record<string, PageMeta[]>);

  // Output docs section
  if (pagesByCategory.docs && pagesByCategory.docs.length > 0) {
    txt += `## Docs\n\n`;
    pagesByCategory.docs.forEach((p) => {
      txt += `- [${p.title}](${p.url})${p.desc ? ": " + p.desc : ""}\n`;
    });
    txt += "\n";
  }

  // Output examples section
  if (pagesByCategory.examples && pagesByCategory.examples.length > 0) {
    txt += `## Examples\n\n`;
    pagesByCategory.examples.forEach((p) => {
      txt += `- [${p.title}](${p.url})${p.desc ? ": " + p.desc : ""}\n`;
    });
    txt += "\n";
  }

  // Output tutorials section
  if (pagesByCategory.tutorial && pagesByCategory.tutorial.length > 0) {
    txt += `## Tutorials\n\n`;
    pagesByCategory.tutorial.forEach((p) => {
      txt += `- [${p.title}](${p.url})${p.desc ? ": " + p.desc : ""}\n`;
    });
    txt += "\n";
  }

  // Output other pages (if there are multiple categories - otherwise list all pages)
  if (Object.keys(pagesByCategory).length > 1) {
    if (pagesByCategory.other && pagesByCategory.other.length > 0) {
      txt += `## Other Resources\n\n`;
      pagesByCategory.other.forEach((p) => {
        txt += `- [${p.title}](${p.url})${p.desc ? ": " + p.desc : ""}\n`;
      });
      txt += "\n";
    }
  } else {
    // If no categorization was successful, just output all pages in a single list
    txt += `## Pages\n\n`;
    pages.forEach((p) => {
      txt += `- [${p.title}](${p.url})${p.desc ? ": " + p.desc : ""}\n`;
    });
    txt += "\n";
  }

  return txt;
}
