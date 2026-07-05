import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import fs from "fs";
import path from "path";

const ai = new GoogleGenAI({});

async function readFile({ file_path }) {
  const content = fs.readFileSync(file_path, "utf-8");
  console.log(`Reading: ${file_path}`);
  return { content };
}

async function writeFile({ file_path, content }) {
  fs.writeFileSync(file_path, content, "utf-8");
  console.log(`Fixed: ${file_path}`);
  return { success: true };
}

async function listFiles({ directory }) {
  const files = [];
  const extensions = [".html", ".css", ".js", ".tsx", ".ts", ".jsx", ".json"];

  function scan(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullpath = path.join(dir, item);

      if (
        fullpath.includes("node_modules") ||
        fullpath.includes("dist") ||
        fullpath.includes("build")
      ) {
        continue;
      }
      const stat = fs.statSync(fullpath);
      if (stat.isDirectory()) {
        scan(fullpath);
      } else if (stat.isFile()) {
        const ext = path.extname(item);
        if (extensions.includes(ext)) {
          files.push(fullpath);
        }
      }
    }
  }
  scan(directory);
  return { files };
}



const listFileTool = {
  name: "listFiles",
  description: "List all files in a directory and its subdirectories",
  parameters: {
    type: "object",
    properties: {
      directory: {
        type: "string",
        description: "The directory path to scan",
      },
    },
    required: ["directory"],
  },
};

const readFileTool = {
  name: "readFile",
  description: "Read a file and return its content",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "The file path to read",
      },
    },
    required: ["file_path"],
  },
};

const writeFileTool = {
  name: "writeFile",
  description: "Write content to a file",
  parameters: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "The file path to write",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["file_path", "content"],
  },
};


//Main function
const tools={
    listFiles: listFiles,
    readFile: readFile,
    writeFile: writeFile
}

export async function runagent(directoryPath) {
    console.log(`Reviewing: ${directoryPath}\n`);

    const History = [
      {
        role: "user",
        parts: [
          { text: `Review the code in the directory ${directoryPath} and fix any errors if present.` },
        ],
      },
    ];

    while (true) {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: History,
        config: {
          systemInstruction: `
            you are an expert code reviewer and fixer, which can review the code in the directory and fix any errors if present.

            Your job:
            1.Use listFiles to get all HTML, CSS, JS, TSX, TS, JSX, JSON files in the directory and its subdirectories.
            2.Use readFile to read the content of each file.
            3.Analyse for:

            **HTML Issues:**
            -Missing doctype,meta tags,semantic HTML
            -Broken links, missing alt attributes, accessibility issues
            -Accessibility issues, missing ARIA attributes, color contrast problems
            

            **CSS Issues:**
            -Unused CSS rules, specificity issues, !important overuse
            -Cross-browser compatibility issues, vendor prefixes, flexbox/grid problems
            -Performance issues, large file sizes, render-blocking CSS

            **JS Issues:**
            -Syntax errors, undefined variables/functions, type errors
            -Performance issues, memory leaks, inefficient algorithms
            -Security vulnerabilities, XSS, CSRF, injection attacks

            **TSX/TS Issues:**
            -Type errors, missing types/interfaces, incorrect type assertions
            -React-specific issues, state management problems, lifecycle method misuse
            -Performance issues, unnecessary re-renders, inefficient component structures

            **JSON Issues:**
            -Syntax errors, missing/extra commas or brackets
            -Incorrect data types or structures
            -Validation against expected schema or format

            4.use writeFile to fix the errors in the files.
            5.After fixing the errors,respond with a summary report  in Text format

            **summary report format:**
             Code review completed
             Total files reviewed: X
             files fixed: Y

             Security fixes:
             -file.js:line-Fixed hardcoded API key
             -auth.js:line-Fixed XSS vulnerability in user input handling


             Bug fixes:
                -file.js:line-Fixed undefined variable error
                -auth.js:line-Fixed incorrect function call
                
            code Quality improvements:
                -file.js:line-Refactored function for better readability
                -auth.js:line-Optimized loop for performance
             
            
            
            `,
            tools: [{
                functionDeclarations: [listFileTool, readFileTool, writeFileTool]
            }],
        },
      });

if(result.functionCalls && result.functionCalls.length > 0){


    for(const functionCall of result.functionCalls){
        const { name, args } = functionCall;
       console.log(`${name}`);
        const toolResponse = await tools[name](args);
        History.push({
          role: "model",
          parts: [{ functionCall }],
        });
History.push({
  role: "user",
  parts: [
    {
      functionResponse: {
        name: functionCall.name,
        response: {
          result: toolResponse,
        },
      },
    },
  ],
});



    }
}else{
    console.log('\n' + result.text);
    break;
}

    }


}

const directory= process.argv[2] || '.';

await  runagent(directory); 