//Day-2

//for multiple messages sending:

// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// async function main() {
//   const chat = ai.chats.create({
//     model: "gemini-2.5-flash",
//   });

//   await chat.sendMessage({
//     message: "My name is Guddu.",
//   });

//   const response = await chat.sendMessage({
//     message: "What is my name?",
//   });

//   console.log(response.text);
// }

// main();

//for single message :
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "what is Trie in dsa?",
  });

  console.log(response.text);
}

main();
// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// const interaction = await ai.interactions.create({
//   model: "gemini-3.5-flash",
//   input: "Explain how AI works in a few words",
// });
// console.log(interaction.output_text);