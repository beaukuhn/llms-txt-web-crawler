import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // No caching for API routes

export async function POST(request: NextRequest) {
  console.log('Generate API route handler called');
  
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://api:3000';
    console.log('Using API URL:', apiUrl);
    
    const body = await request.json();
    console.log('Received request with URL:', body.url);
    
    const response = await fetch(`${apiUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log('API response status:', response.status, response.statusText);
    
    if (!response.ok) {
      console.error('API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `API responded with ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('API response data:', data);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in /api/generate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 