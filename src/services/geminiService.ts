import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedItem } from "./excelService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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

export async function extractTableData(imageBase64: string, mimeType: string): Promise<ExtractedItem[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            text: `Analiza este documento y extrae la tabla de datos siguiendo estrictamente este orden de columnas:
            1. Primera columna: Cantidad (Cant.)
            2. Segunda columna: SKU / Código (Números identificadores del producto).
            3. Tercera columna: Artículo / Descripción (El detalle del producto).
            
            Asegúrate de no confundir el SKU (columna 2) con la Descripción (columna 3). Extrae cada fila de la tabla de forma precisa.`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64.split(',')[1] // Remove the prefix if present
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: extractionSchema
      }
    });

    const result = JSON.parse(response.text || '{"items": []}');
    return result.items || [];
  } catch (error) {
    console.error("Error al extraer datos con Gemini:", error);
    throw new Error("No se pudo procesar la imagen. Verifica que sea clara y contenga las columnas solicitadas.");
  }
}
