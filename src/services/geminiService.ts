import { ExtractedItem } from "./excelService";

export function getLocalApiKey(): string {
  return localStorage.getItem("GEMINI_API_KEY") || "";
}

export function setLocalApiKey(key: string) {
  if (key) {
    localStorage.setItem("GEMINI_API_KEY", key.trim());
  } else {
    localStorage.removeItem("GEMINI_API_KEY");
  }
}

function robustParseExtraction(text: string): { items: any[] } {
  if (!text) return { items: [] };
  
  let trimmed = text.trim();
  
  // Cut down any markdown JSON wrappers
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
      const keys = Object.keys(parsed);
      for (const k of keys) {
        if (Array.isArray(parsed[k])) {
          return { items: parsed[k] };
        }
      }
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

async function extractClientSide(imageBase64: string, mimeType: string, apiKey: string): Promise<ExtractedItem[]> {
  const modelsToTry = [
    "gemini-3.1-flash-lite", // Fast and highly stable
    "gemini-3.5-flash",      // Next generation flash model
    "gemini-2.5-flash"       // Supported standard fallback
  ];

  // Extract raw base64 data regardless of data URI scheme prefix
  const base64Parts = imageBase64.split(",");
  const rawBase64 = base64Parts.length > 1 ? base64Parts[1] : base64Parts[0];

  const prompt = `Analiza este documento y extrae la tabla de datos siguiendo estrictamente este orden de columnas:
  1. Primera columna: Cantidad (Cant.)
  2. Segunda columna: SKU / Código (Números identificadores del producto).
  3. Tercera columna: Artículo / Descripción (El detalle del producto).
  
  Asegúrate de no confundir el SKU (columna 2) con la Descripción (columna 3). Extrae cada fila de la tabla de forma precisa y devuélvela en formato estructurado de JSON con una lista llamada "items" donde cada elemento tiene cantidad, sku, articulo.`;

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: rawBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Error del servidor de Google (${response.status})`);
      }

      const resData = await response.json();
      const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text) {
        throw new Error("No se recibió respuesta de texto del modelo.");
      }

      const parsed = robustParseExtraction(text);
      return parsed.items || [];
    } catch (err) {
      lastError = err;
      console.warn(`Error con modelo cliente ${model}:`, err);
    }
  }

  throw lastError || new Error("No se pudo procesar el archivo mediante la API directa de Gemini.");
}

export async function extractTableData(imageBase64: string, mimeType: string): Promise<ExtractedItem[]> {
  const localKey = getLocalApiKey();

  // If user has local API Key saved, use it directly (faster and guarantees work outside)
  if (localKey) {
    console.log("Ejecutando extracción directa del cliente mediante clave local guardada.");
    return await extractClientSide(imageBase64, mimeType, localKey);
  }

  try {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageBase64,
        mimeType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = errorData.error || `Error del servidor (${response.status})`;
      
      if (response.status === 404 || response.status === 500 || errMsg.toLowerCase().includes("clave de api de gemini no configurada")) {
        throw new Error("SERVER_FALLBACK_NECESSARY");
      }
      
      throw new Error(errMsg);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    const isFallbackNecessary = 
      error instanceof Error && 
      (error.message === "SERVER_FALLBACK_NECESSARY" || 
       error.message.includes("Failed to fetch") || 
       error.message.includes("Load failed") ||
       error.message.includes("NetworkError"));

    if (isFallbackNecessary) {
      if (localKey) {
        return await extractClientSide(imageBase64, mimeType, localKey);
      } else {
        throw new Error("No se pudo establecer conexión con el servidor de IA o falta la configuración de API Key. Si estás utilizando esta aplicación fuera de Google AI Studio, por favor introduce tu API Key propia en el menú de 'Ajustes de API' (icono de engranaje) situado arriba.");
      }
    }

    console.error("Error al extraer datos con la API:", error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : "Ocurrió un error al intentar conectarse al servidor de extracción de IA."
    );
  }
}
