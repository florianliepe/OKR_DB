// functions/index.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const { OpenAI } = require("openai");

// Define the OpenAI API Key from the .env file.
// In the cloud, this will be an environment variable.
const openAIKey = defineString("OPENAI_API_KEY");

exports.askOkrWizard = onCall(async (request) => {
  // 1. Check for authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  // 2. Validate the prompt from the client
  const prompt = request.data.prompt;
  if (!prompt || typeof prompt !== "string" || prompt.length === 0) {
    throw new HttpsError(
      "invalid-argument",
      "The function must be called with a valid 'prompt' string.",
    );
  }
  
  // Initialize the OpenAI client inside the function
  const openai = new OpenAI({
    apiKey: openAIKey.value(), // Access the secret value
  });

  try {
    // 3. Define the AI's role and make the API call
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert OKR (Objectives and Key Results) coach. " +
                   "Your purpose is to help users refine their strategic thinking. " +
                   "You are direct, insightful, and always speak in a professional tone.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const response = completion.choices[0].message.content;

    // 4. Return the response to the client
    return { response: response };

  } catch (error) {
    console.error("OpenAI API call failed:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while contacting the AI wizard.",
    );
  }
});
