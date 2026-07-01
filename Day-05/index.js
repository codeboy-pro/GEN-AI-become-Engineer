import { GoogleGenAI } from "@google/genai";

import readlinesync from "readline-sync";
import dotenv from "dotenv";
dotenv.config();
const ai = new GoogleGenAI({});

//crypto currency tool

async function get_crypto({ coin }) {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coin}`,
  );
  const data = await response.json();
  //   console.log(data);

  return data;
}

// get_crypto({ coin: "bitcoin" });

async function weatherInformation({ city }) {
  const response = await fetch(
    `http://api.weatherapi.com/v1/current.json?key=9246b02ca6834728ae941633263006&q=${city}&aqi=no`,
  );
  const data = await response.json();
  //   console.log(data);
  return data;
}

// weatherInformation({ city: "Kolkata" });

const cryptoInfo = {
  name: "get_crypto",
  description:
    "We can give you the current price or other information about any crypto  ",
  parameters: {
    type: "object",
    properties: {
      coin: {
        type: "string",
        description:
          "It will be the name of the crypto for example bitcoin, ethereum, solana etc.",
      },
    },
    required: ["coin"],
  },
};

const weatherInfo = {
  name: "weatherInformation",
  description:
    "You can give the current weather information of any city in the world for example Kolkata, New York, London etc.",
  parameters: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description:
          "The city name, e.g. San Francisco,Kolkata, New York, London etc.",
      },
    },
    required: ["city"],
  },
};

const tools = [
  {
    functionDeclarations: [cryptoInfo, weatherInfo],
  },
];
const toolsFunction = {
  get_crypto: get_crypto,
  weatherInformation: weatherInformation,
};

const History = [];
async function runAgent() {
  while (true) {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,

      config: {
        tools,
        systemInstruction: `You are a helpful assistant that can provide information about crypto currency and weather information. You can call the tools to get the required information. If you need to get information about crypto currency, use the get_crypto tool. If you need to get weather information, use the weatherInformation tool. Always provide accurate and relevant information based on the user's query.You can also give the answer that are not related to crypto 
        and weather information.`,
      },
    });

    if (response.functionCalls && response.functionCalls.length > 0) {
      console.log("Function call");
      const functioncall = response.functionCalls[0];
      const { name, args } = functioncall;
      // if(name=="get_crypto"){
      //     const res = await get_crypto(args);
      // }else if(name=="weatherInformation"){
      //     const res = await weatherInformation(args);
      // }
      const res = await toolsFunction[name](args);
      const functionResponse = {
        name: functioncall.name,
        response: {
          result: res,
        },
      };
      History.push({
        role: "model",
        parts: [
          {
            functionCall: functioncall,
          },
        ],
      });

      History.push({
        role: "user",
        parts: [{ functionResponse: functionResponse }],
      });
    } else {
      History.push({
        role: "model",
        parts: [{ text: response.text }],
      });
      console.log(response.text);
      break;
    }
  }
}

while (true) {
  const question =readlinesync.question("Ask your question: ");
  if (question.toLowerCase() === "exit") {
    break;
  }
  History.push({
    role: "user",
    parts: [{ text: question }],
  });
  await runAgent();
}
