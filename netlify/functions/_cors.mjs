export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};

export function preflight(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  return null;
}

export function json(statusCode, bodyObj, extraHeaders={}) {
  return { statusCode, headers: { ...corsHeaders, ...extraHeaders }, body: JSON.stringify(bodyObj) };
}
