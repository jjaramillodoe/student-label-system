/**
 * GET /api/admin/email-validation/test
 *
 * Diagnostic: calls the emailawesome GET endpoint and returns the raw response
 * so you can confirm the API key works and see the response shape.
 */
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/requireSession';

const API_BASE = 'https://api.emailawesome.com/api/validations/email_validation';
const API_KEY  = process.env.EMAIL_VALIDATION_API_KEY ?? '';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  console.log('[email-validation/test] API_KEY:', API_KEY ? `${API_KEY.slice(0, 8)}… (length ${API_KEY.length})` : 'MISSING/EMPTY');

  // 1. Test GET (list existing validations) — correct params: page_number, page_size
  const getRes = await fetch(`${API_BASE}?page_number=1&page_size=5`, {
    headers: { Accept: 'application/json', 'x-api-key': API_KEY },
  });
  const getStatus = getRes.status;
  const getText = await getRes.text();
  let getBody: any;
  try { getBody = JSON.parse(getText); } catch { getBody = getText; }

  console.log('[email-validation/test] GET status:', getStatus);
  console.log('[email-validation/test] GET body:', getText.slice(0, 500));

  // 2. POST with corrected field name: "email" (not "email_address")
  const postRes = await fetch(API_BASE, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({ email: 'test-diagnostic@example.com' }),
  });
  const postStatus = postRes.status;
  const postText   = await postRes.text();
  let postBody: any;
  try { postBody = JSON.parse(postText); } catch { postBody = postText; }
  console.log('[email-validation/test] POST {email} status:', postStatus, postText.slice(0, 300));

  return NextResponse.json({
    apiKeyPresent: Boolean(API_KEY),
    apiKeyPreview: API_KEY ? `${API_KEY.slice(0, 8)}…` : null,
    get:  { status: getStatus,  body: getBody },
    post: { status: postStatus, body: postBody },
  });
}
