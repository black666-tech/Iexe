import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not defined");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const convertToCSharp = async (userPrompt: string, isConsole: boolean): Promise<string> => {
  const ai = getAiClient();
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    Du bist ein Senior C# Backend Developer. Deine Aufgabe ist es, Benutzereingaben (die Pseudo-Code, Python, JS oder Text sein können) in validen, kompilierbaren C# Code zu übersetzen.
    
    REGELN:
    1. Der Output muss eine vollständige C# Datei sein (using statements, namespace, class Program, Main method).
    2. Verwende KEINE externen NuGet-Pakete. Nur Standard .NET System Libraries (System, System.IO, System.Net, etc.).
    3. Der Code muss kompatibel mit .NET Framework 4.5+ sein.
    4. Wenn 'isConsole' true ist, nutze Console.WriteLine/ReadLine. Wenn false (Windowed), nutze MessageBox.Show (System.Windows.Forms).
    5. Antworte NUR mit dem Code, keine Markdown Backticks.
  `;

  const prompt = `
    Kontext: Erstelle eine C# Datei basierend auf dieser Anforderung: "${userPrompt}".
    App-Typ: ${isConsole ? 'Konsolenanwendung' : 'Windows Forms Anwendung (GUI)'}.
    
    WICHTIG: Gib mir den reinen C# Code zurück, bereit für den Compiler.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2, // Low temperature for precise code
      }
    });
    
    let code = response.text || "";
    // Clean up markdown if present despite instructions
    code = code.replace(/```csharp/g, "").replace(/```/g, "").trim();
    return code;
  } catch (error) {
    console.error("Gemini Error:", error);
    return `// Fehler bei der Code-Generierung.\n// Bitte manuell C# Code eingeben.\n\nusing System;\nclass Program {\n    static void Main() {\n        Console.WriteLine("Error generating code.");\n        Console.ReadLine();\n    }\n}`;
  }
};

export const validateAndOptimize = async (sourceCode: string): Promise<{ correctedCode: string; analysis: string }> => {
  const ai = getAiClient();
  
  const prompt = `
    Analysiere folgenden C# Code auf Kompilierfehler und Sicherheitsprobleme.
    Korrigiere Fehler, damit er mit csc.exe (Microsoft .NET Compiler) kompiliert werden kann.
    
    Code:
    ${sourceCode}
    
    Antworte im JSON Format:
    {
      "analysis": "Kurze Zusammenfassung was geändert wurde",
      "correctedCode": "Der vollständige, korrigierte Code als String"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text);
  } catch (error) {
    return {
      correctedCode: sourceCode,
      analysis: "KI-Validierung fehlgeschlagen. Originalcode beibehalten."
    };
  }
};
