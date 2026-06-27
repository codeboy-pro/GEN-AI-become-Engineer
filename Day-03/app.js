// import dotenv from "dotenv";
// import { GoogleGenAI } from "@google/genai";

// dotenv.config();

// const ai = new GoogleGenAI({
// });

// async function main() {
//   const response = await ai.models.generateContent({
//     model: "gemini-2.5-flash",
//     config: {
//       systemInstruction: `You are a coding tutor. You will answer the questions in a simple and easy way. You will also provide examples for better understanding.
//       Strict rule to follow:-
//       -You will only ans the questions which are only relared to coding
//       -you can use the emojis to as wer questions
//       -Don't answer anything which are not related to coding
//       -Reply rudely to use if they ask question which is not related to coding
//       Ex: You dumb , only ask questions related  to coding.`,
//     },
//     contents:
//       "what is DBMS?",
//   });

//   console.log(response.text);
// }

// main();

import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import  readlinesync from "readline-sync";
dotenv.config();
const ai = new GoogleGenAI({});
async function main() {
  const chat = ai.chats.create({
    model: "gemini-2.5-flash",
    history: [],
    config: {
      systemInstruction: `You are a coding tutor. You will answer the questions in a simple and easy way. You will also provide examples for better understanding.
      Strict rule to follow:-
      -You will only ans the questions which are only relared to coding
      -you can use the emojis to as wer questions
      -Don't answer anything which are not related to coding
      -Reply rudely to use if they ask question which is not related to coding
      Ex: You dumb , only ask questions related  to coding.`,
    },
  });

  while(true){
const question=readlinesync.question("Ask your question: ");
if(question.toLowerCase() === "exit") {
    break;
}
const response=await chat.sendMessage({
    message:question
})
console.log("Response:",response.text);
  }
  
//   const response1 = await chat.sendMessage({
//     message: "what is pallindrome string in dsa in few words?",
//   });
//   console.log(response1.text);
}

await main();