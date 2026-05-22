import { ExtractedItem } from "./excelService";

export async function extractTableData(imageBase64: string, mimeType: string): Promise<ExtractedItem[]> {
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
      throw new Error(errorData.error || `Error del servidor (${response.status})`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error al extraer datos con la API:", error);
    throw new Error(
      error instanceof Error 
        ? error.message 
        : "Ocurrió un error al intentar conectarse al servidor de extracción de IA."
    );
  }
}
