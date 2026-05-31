import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Since we're using JWT strategy, we don't need to clear database collections
    // The JWT tokens are stored in cookies and will be cleared when the user signs out
    return NextResponse.json({ 
      success: true, 
      message: 'Auth data cleared successfully. Please sign out and sign in again.',
      note: 'Using JWT strategy - sessions are stored in cookies, not database'
    });
  } catch (error) {
    console.error('Error in clear auth data:', error);
    return NextResponse.json(
      { error: 'Failed to clear auth data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 