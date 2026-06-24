import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyAJr1nTRf37LLFruLaUIA3qT5z9xsXUWeU",
});

async function main() {
  const interaction = await ai.interactions.create({
    model: "gemini-2.5-flash",
    input: [
      {
        role: "user",
        parts: [{ text: "what is my name?" }],
      },
      {
        role: "model",
        parts: [{ text: "I don't know your name. Can you tell me?" }],
      },
      {
        role: "user",
        parts: [{ text: "My name is Guddu." }],
      },
      {
        role: "model",
        parts: [{ text: "Nice to meet you, Guddu!" }],
      },
      {
        role: "user",
        parts: [{ text: "What is my name?" }],
      },
    ],
  });
  console.log(interaction.output_text);
}

main();


//readline sync
//history auto save