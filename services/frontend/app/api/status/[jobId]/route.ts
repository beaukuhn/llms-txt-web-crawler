import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const jobId = params.jobId;
  console.log(`Status API route handler called for job: ${jobId}`);
  
  try {
    // Get API URL from environment variables
    // When running in Docker, services can access each other via their service names
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api:3000';
    console.log(`Using API URL: ${apiUrl} for job: ${jobId}`);
    
    // Show all URLs we're trying
    console.log(`Will try these URLs in order:
      1. ${apiUrl}/generate/status/${jobId}
      2. http://api:3000/generate/status/${jobId}
      3. http://localhost:3000/generate/status/${jobId}`);
      
    // First try with configured API URL
    try {
      const response = await fetch(`${apiUrl}/generate/status/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`First attempt status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Success with configured URL: ${apiUrl}`);
        return NextResponse.json(data);
      }
    } catch (error) {
      console.error(`Failed with configured URL ${apiUrl}:`, error);
    }
    
    // Try with api service name as fallback
    try {
      const fallbackUrl = `http://api:3000/generate/status/${jobId}`;
      console.log(`Trying fallback URL: ${fallbackUrl}`);
      
      const response = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`Fallback attempt status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Success with fallback URL: http://api:3000`);
        return NextResponse.json(data);
      }
    } catch (error) {
      console.error("Failed with fallback URL http://api:3000:", error);
    }
    
    // Try with localhost as last resort
    const lastResortUrl = `http://localhost:3000/generate/status/${jobId}`;
    console.log(`Trying last resort URL: ${lastResortUrl}`);
    
    const response = await fetch(lastResortUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`Last resort attempt status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`All API attempts failed for job ${jobId}`);
      return NextResponse.json(
        { error: `API responded with ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    // Parse and return response data
    const data = await response.json();
    console.log(`Success with last resort URL: http://localhost:3000`);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Error in /api/status/${jobId}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 