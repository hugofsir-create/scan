import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing with size limits so we can receive base64 encoded images or PDFs safely
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API endpoint for processing sheets/images with Gemini
  app.post("/api/extract", async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "No se recibió el documento o el formato no es válido." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "Clave de API de Gemini no configurada en las variables de entorno. Por favor, añádela en la sección de Secretos." 
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const extractionSchema = {
        type: Type.OBJECT,
        properties: {
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                cantidad: {
                  type: Type.STRING,
                  description: "Valor de la primera columna (Cantidad).",
                },
                sku: {
                  type: Type.STRING,
                  description: "Valor de la segunda columna (SKU, Código o ID numérico). Es muy importante extraer este número correctamente.",
                },
                articulo: {
                  type: Type.STRING,
                  description: "Valor de la tercera columna (Nombre del artículo o Descripción detallada).",
                }
              },
              required: ["cantidad", "sku", "articulo"]
            }
          }
        },
        required: ["items"]
      };

      // Extract raw base64 data regardless of data URI scheme prefix
      const base64Parts = imageBase64.split(",");
      const rawBase64 = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            text: `Analiza este documento y extrae la tabla de datos siguiendo estrictamente este orden de columnas:
            1. Primera columna: Cantidad (Cant.)
            2. Segunda columna: SKU / Código (Números identificadores del producto).
            3. Tercera columna: Artículo / Descripción (El detalle del producto).
            
            Asegúrate de no confundir el SKU (columna 2) con la Descripción (columna 3). Extrae cada fila de la tabla de forma precisa y devuélvela en formato estructurado.`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: rawBase64
            }
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: extractionSchema
        }
      });

      const text = response.text;
      const result = JSON.parse(text || '{"items": []}');
      res.json(result.items || []);
    } catch (error) {
      console.error("Error en extracción:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Error al procesar el archivo con Gemini." 
      });
    }
  });

  // Serve Vite or Static files depending on environment
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
