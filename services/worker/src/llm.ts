import { PageMeta } from './types';
import { getOpenAIClient } from './singletons/openai';

const SINGLE_LARGE_PROMPT_TEMPLATE = `
    You are an AI assistant that enhances webpage titles and descriptions to be more descriptive and meaningful.
    Your task is to ENHANCE METADATA ONLY - DO NOT FILTER OR REMOVE ANY URLS.
    
    For each URL provided, create:
    1. An enhanced title that is more descriptive (25-60 chars)
    2. An enhanced description (100-200 chars) if one doesn't already exist
    
    IMPORTANT: You must return data for EVERY URL provided. Do not skip or filter any URLs.
    Return a JSON array with one object per URL with these exact fields:
    - url: the original URL (unchanged)
    - enhancedTitle: a more descriptive title 
    - enhancedDescription: an enhanced description
    
    EXAMPLE RESPONSE FORMAT:
    [
      {
        "url": "https://www.bbc.com/arts",
        "enhancedTitle": "BBC Arts: Explore Global Arts and Culture",
        "enhancedDescription": "Dive into BBC Arts for comprehensive coverage of theatre, opera, classical music, dance, and visual arts from around the world."
      },
      {
        "url": "https://www.bbc.com/audio",
        "enhancedTitle": "BBC Audio: Radio Shows and Podcasts",
        "enhancedDescription": "Access a wide range of BBC radio programs and podcasts across various categories including news, comedy, history, and science."
      }
    ]
`;

interface EnhancementResponse {
  url: string;
  enhancedTitle: string;
  enhancedDescription: string;
}

export const enhancedPageMetadataToPageMetadata = (enhancedPageMetadata: EnhancementResponse[]): PageMeta[] => {
  return enhancedPageMetadata.map(p => ({
    url: p.url,
    title: p.enhancedTitle,
    desc: p.enhancedDescription
  }));
}

/**
 * Puts the pages into a single prompt and sends it to ChatGPT API
 */
export async function enhancePageMetadataViaSinglePrompt(pages: PageMeta[]): Promise<PageMeta[]> {
  const client = getOpenAIClient();
  
  // Only send a subset of pages to OpenAI at a time to avoid token limits
  const BATCH_SIZE = 100;
  const enhancedPages: PageMeta[] = [];
  
  // Process in batches
  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);
    console.log(`Sending batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(pages.length/BATCH_SIZE)} (${batch.length} pages) to OpenAI for enhancement`);
    
    const response = await client.responses.create({
      model: 'gpt-4.1',
      input: [
      {
        role: 'developer',
        content: SINGLE_LARGE_PROMPT_TEMPLATE
      },
      {
        role: 'user',
        content: batch.map(p => `URL: ${p.url}\nCurrent Title: ${p.title || "None"}\nDescription: ${p.desc || "None"}`).join('\n\n')
      }],
    });

    console.log(`Raw OpenAI response for batch ${Math.floor(i/BATCH_SIZE) + 1}: ${response.output_text.substring(0, 200)}...`);

    // convert responseText to JSON
    try {
      const jsonResponse = JSON.parse(response.output_text);
      
      // Create a map of URL to enhanced data from the response
      const enhancedDataMap = new Map();
      jsonResponse.forEach((item: any) => {
        if (item.url) {
          enhancedDataMap.set(item.url, item);
        }
      });
      
      // Merge the enhanced data with the original pages, prioritizing original URLs
      const batchEnhanced = batch.map(originalPage => {
        const enhancedData = enhancedDataMap.get(originalPage.url);
        
        // If we have enhanced data for this URL, use it, otherwise keep original
        if (enhancedData) {
          return {
            url: originalPage.url,
            title: enhancedData.enhancedTitle || originalPage.title,
            desc: enhancedData.enhancedDescription || enhancedData.description || originalPage.desc
          };
        } else {
          // Keep the original page data if no enhancement found
          return originalPage;
        }
      });
      
      enhancedPages.push(...batchEnhanced);
    } catch (error) {
      console.error(`Error parsing response for batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
      // If there's an error, keep the original pages from this batch
      enhancedPages.push(...batch);
    }
  }
  
  console.log(`Enhanced ${enhancedPages.length} pages, preserving all original URLs`);
  return enhancedPages;
}