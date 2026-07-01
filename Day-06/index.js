import { GoogleGenAI } from "@google/genai";
import { exec } from "child_process";
import os from "os";
import util from "util";
import readlinesync from "readline-sync";
import dotenv from "dotenv";
dotenv.config();
const execute = util.promisify(exec);
const ai = new GoogleGenAI({});

const platform = os.platform();
//tool

async function executeCommand({ command }) {
  try {
    const { stdout, stderr } = await execute(command);
    if (stderr) {
      return `Error: ${stderr}`;
    }
    return `Success:${stdout}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

const commandExecutor = {
  name: "executeCommand",
  description:
    "It takes any shell/terminal command and executes it .It will help to create any foler and files",
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "The shell/terminal command to execute. Ex: mkdir calculator,touch calculator/index.js etc",
      },
    },
    required: ["command"],
  },
};
const History = [];
async function buildWebsite() {
  while (true) {
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: History,
      config: {
        systemInstruction: `you are a website builder, which can create the frontend part of a wensite using shell/terminal command.
             you will give me shell/terminal command one by one and our tool will exrcute the command .and our tool will execute it.
             Give the command according the operating system we are using .
         my current operating system is ${platform}.

         Kindly use best practice for commands,it should handle multiline write also efficiently.
         your job:
         1:Analyze the user query
         2: Take the nessary action after analyzing the user query by giving shell command 


         Step by step Guide:
         1.first you have to create to create a folder for the website, ex: mkdir calculator
         2.Give shell/terminal command to create the html file, ex:touch calculator/index.html
         3.Give shell/terminal command to create the css file,
         4.Give shell/terminal command to create the js file,
         5.Give shell/terminal command to write the code in the html file.
         6.Give shell/terminal command to write the code in the css file.
         7.Give shell/terminal command to write the code in the js file.
        8.fix the error if they are present at the step by writing ,update or deleting

             `,
        tools: [
          {
            functionDeclarations: [commandExecutor],
          },
        ],
      },
    });

    if (result.functionCalls && result.functionCalls.length > 0) {
      const functioncall = result.functionCalls[0];
      const { name, args } = functioncall;
      const toolResponse = await executeCommand(args);

      const functionResponse = {
        name: functioncall.name,
        response: {
          result: toolResponse,
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
      console.log(result.text);
      History.push({
        role: "model",
        parts: [{ text: result.text }],
      });
    }
  }
}
async function main() {
  while (true) {
    const question = readlinesync.question("Ask me anything :--->");

    if (question === "exit") break;

    History.push({
      role: "user",
      parts: [{ text: question }],
    });

    await buildWebsite();
  }
}

main();
