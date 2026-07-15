import readlineSync from "readline-sync";
import { Pinecone } from "@pinecone-database/pinecone";
import * as dotenv from "dotenv";
dotenv.config();
import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

//Configuration
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-embedding-001",
});

const model = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-2.5-flash",
  temperature: 0.3,
});
//Configure pinecone
const pinecone = new Pinecone();
const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

async function chatting(question) {
//intent model ko introduce karo -> Homework

  //question ki embeeding create karna hai
  const queryVector = await embeddings.embedQuery(question);
  //embeeding aya hai uske vector Db ke ander search karna top10
  const searchResults = await pineconeIndex.query({
    topK: 10,
    vector: queryVector,
    includeMetadata: true,
  });

//   console.log(searchResults);
  const context = searchResults.matches
    .map((match) => match.metadata.text)
    .join("\n\n---\n\n");

  //top10+question isko mai llm ko de dunga
  // Step 4: Create a prompt template
  const promptTemplate = PromptTemplate.fromTemplate(`
You are a helpful assistant answering questions based on the provided documentation.

Context from the documentation: 
{context}

Question: {question}

Instructions:
- Answer the question using ONLY the information from the context above
- If the answer is not in the context, say "I don't have enough information to answer that question."
- Be concise and clear
- Use code examples from the context if relevant

Answer:
        `);

  // Step 5: Create a chain (prompt → model → parser)
  const chain = RunnableSequence.from([
    promptTemplate,
    model,
    new StringOutputParser(),
  ]);

  // Step 6: Invoke the chain and get the answer
  const answer = await chain.invoke({
    context: context,
    question: question,
  });

  //Output create kar dunga
  console.log("Answer:", answer);
}

async function main() {
  const userProblem = readlineSync.question("Ask me anything--> ");
  await chatting(userProblem);
  main();
}

main();
