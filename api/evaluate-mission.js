import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import mammoth from "mammoth";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export default async function handler(req, res) {
  console.log("FUNCTION STARTED");
  console.log("METHOD:", req.method);
  console.log("BODY:", req.body);
  try {
    const {
      title,
      description,
      response,
      fileUrl,
      fileName,
    } = req.body;

    let fileContent = "";
    let imagePart = null;

    if (fileUrl && fileName) {
      try {
        const fileResponse = await axios.get(fileUrl, {
          responseType: "arraybuffer",
        });

        const buffer = Buffer.from(fileResponse.data);
        const lowerFileName = fileName.toLowerCase();

        if (lowerFileName.endsWith(".docx")) {
          const parsedDocx = await mammoth.extractRawText({
            buffer,
          });

          fileContent = parsedDocx.value;
        } else if (
          lowerFileName.endsWith(".png") ||
          lowerFileName.endsWith(".jpg") ||
          lowerFileName.endsWith(".jpeg") ||
          lowerFileName.endsWith(".webp")
        ) {
          const mimeType = lowerFileName.endsWith(".png")
            ? "image/png"
            : lowerFileName.endsWith(".webp")
            ? "image/webp"
            : "image/jpeg";

          imagePart = {
            inlineData: {
              mimeType,
              data: buffer.toString("base64"),
            },
          };
        }
      } catch (fileError) {
        console.error(
          "Error leyendo archivo:",
          fileError
        );
      }
    }

    const prompt = `
Eres un profesor de una academia de automatización e IA.

Evalúa la respuesta del estudiante.

MISIÓN:
${title}

DESCRIPCIÓN:
${description}

RESPUESTA:
${response}

ARCHIVO ADJUNTO:
${fileName || "Sin archivo"}

URL DEL ARCHIVO:
${fileUrl || "Sin archivo"}

CONTENIDO DEL ARCHIVO:
${fileContent || "Sin contenido extraído"}

CRITERIOS:

1. Debe responder lo solicitado.
2. Debe responder todo.
3. Puede ser sencilla.
4. Debe sonar natural.
5. No rechaces por ortografía.
6. Si existe contenido extraído de un archivo, evalúalo junto con la respuesta.
7. El archivo adjunto puede contener evidencia o parte de la solución.
8. Si existe una imagen adjunta, analízala y úsala para evaluar la misión.

Devuelve ÚNICAMENTE un JSON válido. No uses markdown, no uses bloques de código, no agregues texto antes o después del JSON.

{
  "approved": true,
  "feedback": "Buen trabajo"
}
`;

    console.log("ABOUT TO CALL GEMINI");
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: imagePart
        ? [prompt, imagePart]
        : prompt,
    });
    console.log("GEMINI RESPONSE RECEIVED");

    const text = result.text.trim();
    console.log("RAW GEMINI:");
    console.log(JSON.stringify(result, null, 2));

    console.log("TEXT:");
    console.log(text);

    let evaluation;

    try {
      const cleanedText = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      evaluation = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("Error parseando respuesta Gemini:", text);

      return res.status(500).json({
        error: "Gemini devolvió un formato inválido",
      });
    }

    console.log("FINAL EVALUATION:");
    console.log(JSON.stringify(evaluation, null, 2));
    res.json({
      approved: Boolean(evaluation.approved),
      feedback: evaluation.feedback || "Sin retroalimentación",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Error evaluando misión",
    });
  }
}