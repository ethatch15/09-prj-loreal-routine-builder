// Copy this code into your Cloudflare Worker script (loreal-chatbot).
// It works for BOTH projects:
//   - Normal requests (Project 8 chatbot, routine builder) use Chat Completions.
//   - Requests with  webSearch: true  use the Responses API with web search,
//     and return the answer plus a list of source links (citations).
// Your API key is NOT in this file. The Worker reads it from the secret
// named OPENAI_API_KEY in Cloudflare → Settings → Variables and Secrets.

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const apiKey = env.OPENAI_API_KEY; // the secret stored in Cloudflare
    const userInput = await request.json();

    // ---------- Web search requests ----------
    if (userInput.webSearch === true) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          input: userInput.messages, // the same messages array as before
          tools: [{ type: 'web_search' }], // lets the model search the web
          max_output_tokens: 1000
        })
      });

      const data = await response.json();

      // Pass OpenAI errors straight back to the website
      if (data.error) {
        return new Response(JSON.stringify({ error: data.error }), { headers: corsHeaders });
      }

      // The answer is the "message" item in the output list
      const message = (data.output || []).find((item) => item.type === 'message');
      const textPart = message && message.content.find((part) => part.type === 'output_text');

      if (!textPart) {
        return new Response(
          JSON.stringify({ error: { message: 'No answer came back from the web search. Please try again.' } }),
          { headers: corsHeaders }
        );
      }

      // Citations: each one marks a piece of the text and the web page it came from
      const citations = (textPart.annotations || []).filter((a) => a.type === 'url_citation');

      // Remove the inline citation text like "([site.com](https://...))" from the answer.
      // We go from the END of the text backwards so the positions stay correct.
      let text = textPart.text;
      [...citations]
        .sort((a, b) => b.start_index - a.start_index)
        .forEach((c) => {
          text = text.slice(0, c.start_index) + text.slice(c.end_index);
        });

      // Make a simple list of unique sources (no duplicate links)
      const sources = [];
      citations.forEach((c) => {
        if (!sources.some((s) => s.url === c.url)) {
          sources.push({ title: c.title || c.url, url: c.url });
        }
      });

      // Send it back in the SAME shape as Chat Completions,
      // so the website still reads data.choices[0].message.content
      const result = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: text.trim(),
              sources: sources
            }
          }
        ]
      };
      return new Response(JSON.stringify(result), { headers: corsHeaders });
    }

    // ---------- Normal requests (no web search) ----------
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: userInput.messages,
        max_completion_tokens: 1000
      })
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), { headers: corsHeaders });
  }
};
