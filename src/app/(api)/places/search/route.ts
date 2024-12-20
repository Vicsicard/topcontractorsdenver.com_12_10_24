import { NextRequest, NextResponse } from 'next/server';
import { makeRequestWithBackoff } from '@/utils/apiUtils';

// Skip API calls during build time
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

interface Place {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  types?: string[];
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
}

interface PlaceDetailsResult {
  formatted_phone_number?: string;
  website?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
}

interface PlacesApiResponse {
  results: Place[];
  status: string;
  error_message?: string;
}

interface PlaceDetailsApiResponse {
  result: PlaceDetailsResult;
  status: string;
}

// This ensures the route is handled at runtime
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Return mock data during build time
  if (isBuildTime) {
    return NextResponse.json({
      results: [],
      status: 'success',
      _info: 'Build time response'
    });
  }

  try {
    const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    const GOOGLE_PLACES_API_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const GOOGLE_PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

    if (!GOOGLE_PLACES_API_KEY) {
      console.warn('API key not configured');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const location = searchParams.get('location') || 'Denver, CO';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const searchQuery = `${query} in ${location}`;
    const url = new URL(GOOGLE_PLACES_API_URL);
    url.searchParams.append('query', searchQuery);
    url.searchParams.append('key', GOOGLE_PLACES_API_KEY);
    url.searchParams.append('type', 'business');

    const response = await makeRequestWithBackoff(() => fetch(url));
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json() as PlacesApiResponse;
    
    if (data.status !== 'OK') {
      throw new Error(`API returned status: ${data.status}`);
    }

    // Fetch additional details for each place
    const placesWithDetails = await Promise.all(
      data.results.map(async (place) => {
        try {
          const detailsUrl = new URL(GOOGLE_PLACES_DETAILS_URL);
          detailsUrl.searchParams.append('place_id', place.place_id);
          detailsUrl.searchParams.append('key', GOOGLE_PLACES_API_KEY);
          detailsUrl.searchParams.append('fields', 'formatted_phone_number,website,opening_hours');
          
          const detailsResponse = await makeRequestWithBackoff(() => fetch(detailsUrl));
          
          if (!detailsResponse.ok) {
            throw new Error(`API error: ${detailsResponse.statusText}`);
          }

          const placeDetails = await detailsResponse.json() as PlaceDetailsApiResponse;

          if (placeDetails.status !== 'OK') {
            throw new Error(`API returned status: ${placeDetails.status}`);
          }

          return {
            ...place,
            phone_number: placeDetails.result?.formatted_phone_number,
            website: placeDetails.result?.website,
            opening_hours: placeDetails.result?.opening_hours
          };
        } catch (error) {
          console.error('Error fetching place details:', error);
          return place;
        }
      })
    );

    return NextResponse.json({ results: placesWithDetails, status: 'success' });
  } catch (error) {
    console.error('Search places error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}