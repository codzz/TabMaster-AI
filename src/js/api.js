// API related functions
export async function convertToJson(data) {
  const response = await fetch('https://api.ajithjoseph.com/api/Gemini/convert-to-json', {
    method: 'POST',
    headers: {
      'accept': 'text/plain',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const apiResult = await response.text();
  return JSON.parse(apiResult);
}