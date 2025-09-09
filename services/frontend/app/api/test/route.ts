import { NextRequest, NextResponse } from 'next/server';

// Force the route to be dynamic without caching
export const dynamic = 'force-dynamic';

// Define a GET handler
export async function GET() {
  console.log('Test API GET route handler called');
  
  return NextResponse.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
}

// Define a POST handler
export async function POST(request: NextRequest) {
  console.log('Test API POST route handler called');
  
  let body = {};
  try {
    body = await request.json();
  } catch (e) {
    console.error('Error parsing request body:', e);
  }
  
  return NextResponse.json({ 
    message: 'POST received!',
    receivedData: body,
    timestamp: new Date().toISOString()
  });
} 