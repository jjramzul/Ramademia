import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import * as pdf from "pdf-parse";
import mammoth from "mammoth";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.post("/evaluate-mission", async (req, res) => {
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

        if (lowerFileName.endsWith(".pdf")) {
          const parsedPdf = await pdf(buffer);
          fileContent = parsedPdf.text;
        } else if (lowerFileName.endsWith(".docx")) {
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

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: imagePart
        ? [prompt, imagePart]
        : prompt,
    });

    const text = result.text.trim();

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
});

app.listen(process.env.PORT, () => {
  console.log(
    `Servidor iniciado en puerto ${process.env.PORT}`
  );
});