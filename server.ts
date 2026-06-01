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

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

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

      // List of candidate models to try as fallbacks under high demand load
      const modelsToTry = [
        "gemini-3.1-flash-lite", // Extremely high availability, fast, and stable
        "gemini-flash-latest",   // Re-routed to stable legacy/high-capacity pool
        "gemini-3.5-flash"       // New model, handled as alternative fallback
      ];

      let lastError: any = null;
      let responseText = "";

      for (const modelName of modelsToTry) {
        let attempts = 0;
        const maxAttempts = 3; // Retry up to 3 times per model with progressive backoff and fallback settings
        
        while (attempts < maxAttempts) {
          try {
            console.log(`Iniciando extracción con modelo: ${modelName} (Intento ${attempts + 1}/${maxAttempts})`);
            
            // On the last attempt of each model, we omit the responseSchema as a safety fallback 
            // in case model-specific constraints or API versions fail with strict schema under high load
            const useSchema = (attempts < maxAttempts - 1);
            const generationConfig: any = {
              responseMimeType: "application/json"
            };
            if (useSchema) {
              generationConfig.responseSchema = extractionSchema;
            }

            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  text: `Analiza este documento y extrae la tabla de datos siguiendo estrictamente este orden de columnas:
                  1. Primera columna: Cantidad (Cant.)
                  2. Segunda columna: SKU / Código (Números identificadores del producto).
                  3. Tercera columna: Artículo / Descripción (El detalle del producto).
                  
                  Asegúrate de no confundir el SKU (columna 2) con la Descripción (columna 3). Extrae cada fila de la tabla de forma precisa y devuélvela en formato estructurado de JSON con una lista llamada "items" donde cada elemento tiene cantidad, sku, articulo.`
                },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: rawBase64
                  }
                }
              ],
              config: generationConfig
            });

            responseText = response.text || "";
            if (responseText) {
              lastError = null;
              break; // Success! Break the attempt loop for this model
            }
          } catch (err: any) {
            lastError = err;
            const errMsg = String(err?.message || err);
            console.warn(`Error con modelo ${modelName} (Intento ${attempts + 1}):`, errMsg);

            // Determine if the error is temporary/transient (e.g. 503 high demand, 429 rate limit)
            const isTransient = 
              err?.status === "UNAVAILABLE" || 
              err?.status === "RESOURCE_EXHAUSTED" ||
              errMsg.includes("503") || 
              errMsg.includes("demand") || 
              errMsg.includes("limit") ||
              errMsg.includes("429");

            attempts++;
            if (isTransient && attempts < maxAttempts) {
              const backoffDelay = attempts * 2000;
              console.log(`El servicio está sobrecargado o ocupado. Esperando ${backoffDelay}ms antes de reintentar...`);
              await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            } else if (!isTransient) {
              // If it's not a transient state (such as schema mismatch configuration), try without schema next attempt
              if (attempts >= maxAttempts) {
                break;
              }
            }
          }
        }

        if (!lastError && responseText) {
          console.log(`Extracción exitosa completada usando el modelo: ${modelName}`);
          break; // Success! Break the model outer loop
        }
      }

      if (lastError) {
        console.error("Todos los modelos y reintentos fallaron:", lastError);
        // Provide a clearer, user-friendly message for 503/high-demand error
        const errMsg = String(lastError?.message || lastError);
        if (errMsg.includes("demand") || errMsg.includes("503") || lastError?.status === "UNAVAILABLE") {
          throw new Error("Los servidores de Google AI Studio están experimentando una sobrecarga temporal de alta demanda hoy. Por favor, reintenta subir el archivo en unos instantes o utiliza una imagen de menor peso.");
        }
        throw lastError;
      }

      // Robust JSON Parse
      let result = { items: [] };
      try {
        result = robustParseExtraction(responseText);
      } catch (parseErr) {
        console.error("Fallo definitivo parseando JSON extraído:", parseErr);
        throw new Error("No se pudo estructurar la información del documento correctamente. Por favor, intenta de nuevo o sube una imagen más clara.");
      }

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

function robustParseExtraction(text: string): { items: any[] } {
  if (!text) return { items: [] };
  
  let trimmed = text.trim();
  
  // Cut down any markdown JSON wrappers: ```json ... ``` or ``` ... ```
  if (trimmed.startsWith("```")) {
    const lines = trimmed.split("\n");
    if (lines[0].startsWith("```")) {
      lines.shift();
    }
    if (lines[lines.length - 1].startsWith("```")) {
      lines.pop();
    }
    trimmed = lines.join("\n").trim();
  }
  
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed)) {
      return { items: parsed };
    }
    if (parsed && Array.isArray(parsed.items)) {
      return parsed;
    }
    if (parsed && typeof parsed === "object") {
      // Maybe the model returned an object with items inside under another key
      const keys = Object.keys(parsed);
      for (const k of keys) {
        if (Array.isArray(parsed[k])) {
          return { items: parsed[k] };
        }
      }
      // Or maybe it's a single item itself? Wrap in items
      return { items: [parsed] };
    }
    return { items: [] };
  } catch (err) {
    console.warn("JSON.parse directo falló, intentando extracción con regex.", err);
    // Try to find a JSON array or object inside the text if something else was returned
    const arrayMatch = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      try {
        return { items: JSON.parse(arrayMatch[0]) };
      } catch (e) {}
    }
    
    const objectMatch = trimmed.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        const parsedObj = JSON.parse(objectMatch[0]);
        if (parsedObj && Array.isArray(parsedObj.items)) {
          return parsedObj;
        }
        const keys = Object.keys(parsedObj);
        for (const k of keys) {
          if (Array.isArray(parsedObj[k])) {
            return { items: parsedObj[k] };
          }
        }
        return { items: [parsedObj] };
      } catch (e) {}
    }
    
    throw new Error("No se pudo parsear el resultado de la extracción como JSON estructurado.");
  }
}

startServer();
