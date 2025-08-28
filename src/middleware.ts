import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Enhanced CORS handling for all API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Monitor-Request, X-User-Id, X-Session-Id, X-Correlation-Id, Accept, Origin, User-Agent, Referer',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      console.log(`CORS preflight for ${request.nextUrl.pathname} from origin: ${request.headers.get('origin')}`);
      return new NextResponse(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // Log incoming requests for debugging
    console.log(`API Request: ${request.method} ${request.nextUrl.pathname} from origin: ${request.headers.get('origin')}`);

    // Add CORS headers to all API responses
    const response = NextResponse.next();
    
    // Set all CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
  ],
};
