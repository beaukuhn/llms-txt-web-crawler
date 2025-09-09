import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  console.log('Generate/Bulk API route handler called');
  
  try {
    const body = await request.json();
    console.log('Received request with URLs:', body.urls?.length || 0);
    
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api:3000';
    console.log('Using API URL:', apiUrl);
    
    console.log(`Will try these URLs in order:
      1. ${apiUrl}/generate/bulk
      2. http://api:3000/generate/bulk
      3. http://localhost:3000/generate/bulk`);
    
    // First try with configured API URL
    try {
      console.log(`First attempt with URL: ${apiUrl}/generate/bulk`);
      const response = await fetch(`${apiUrl}/generate/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
      const fallbackUrl = 'http://api:3000/generate/bulk';
      console.log(`Trying fallback URL: ${fallbackUrl}`);
      
      const response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
    const lastResortUrl = 'http://localhost:3000/generate/bulk';
    console.log(`Trying last resort URL: ${lastResortUrl}`);
    
    const response = await fetch(lastResortUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log(`Last resort attempt status: ${response.status}`);
    
    if (!response.ok) {
      console.error('All API attempts failed');
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
    console.error('Error in /api/generate/bulk:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 